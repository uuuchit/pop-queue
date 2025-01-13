const { mongoClient, objectId } = require('./mongo.js');
const { redisClient } = require('./redis.js');
const { sleep, parseDocFromRedis } = require('./helpers.js');
const Redlock = require('redlock');
const config = require('./config');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { WebClient } = require('@slack/web-api');
const axios = require('axios');

class PopQueue {

    constructor(dbUrl, redis, dbName, cName, retries, mongoShardConfig = null, redisClusterConfig = null) {
        this.dbUrl = dbUrl || config.dbUrl;
        this.redis = redis || config.redisUrl;
        this.cName = cName || config.collectionName;
        this.dbName = dbName || config.dbName;
        this.retries = retries || config.retries;
        this.runners = {};
        this.loopRunning = false;
        this.mongoShardConfig = mongoShardConfig;
        this.redisClusterConfig = redisClusterConfig;
        this.workerPool = [];
        this.maxWorkers = 5; // Default max workers
        this.rateLimit = 100; // Default rate limit
        this.resourceAware = false; // Default resource-aware execution
        this.plugins = [];
        this.eventHooks = {};
        this.notificationConfig = config.notificationConfig || {};
    }

    async define(name, fn, options = {}) {
        this.runners[name] = {
            fn,
            options,
            cName: options.cName || "pop_queues"
        };
        if (options.middleware) {
            this.runners[name].middleware = options.middleware;
        }
    }

    async start(runLoop) {
        await this.startLoop();
        setInterval(async () => {
            if (!this.loopRunning) {
                await this.startLoop();
            }
        }, 1000)
    }

    getDbCollectionName(name) {
        if (this.runner && this.runners[name] && this.runners[name].cName) {
            return this.runners[name].cName
        } else {
            return this.cName;
        }
    }

    async startLoop() {
        let names = Object.keys(this.runners);
        if (names.length) {
            this.loopRunning = true;
            while (true) {
                let counter = 0;
                for (let name of names) {
                    try {
                        await this.run(name);
                    } catch (e) {
                        if (e.code == 404) {
                            counter++;
                        }
                    }
                }
                if (counter == names.length) {
                    this.loopRunning = false
                    break;                    
                }
            }
        }
    }

    async connect() {
        await Promise.all([this.connectDb(), this.connectRedis()]);
    }

    async connectDb() {
        try {
            this.db =  await mongoClient(this.dbUrl, this.dbName);
            console.log('db connected');
            if (this.mongoShardConfig) {
                await this.db.admin().command({ enableSharding: this.dbName });
                await this.db.admin().command({ shardCollection: `${this.dbName}.${this.cName}`, key: this.mongoShardConfig });
                console.log('MongoDB sharding enabled');
            }
        } catch(e) {
            console.log(e);        
        }
    }

    async connectRedis() {
        try {
            if (this.redisClusterConfig) {
                this.redisClient = new Redis.Cluster(this.redisClusterConfig);
                console.log('Redis cluster connected');
            } else {
                this.redisClient =  await redisClient(this.redis);
                console.log('redis connected');
            }
            this.redlock = new Redlock([this.redisClient], {
                retryCount: 10,
                retryDelay: 200
            });
        } catch(e) {
            console.log(e);        
        }
    }

    async now(job, name, identifier, score, priority = 0, delay = 0) {
        try {
            let document = {data: job, createdAt: new Date(), name, identifier, priority, delay};
            if (!this.db) {
                await this.connect();
                console.log("Connected Db");
            }
            await this.db.collection(this.getDbCollectionName(name)).findOneAndUpdate({identifier}, {$set: document}, {upsert: true});
            await this.pushToQueue(document, name, identifier, score, priority, delay);
        } catch(e) {
            console.log(e);        
        }
    }

    async pushToQueue(document, name, identifier, score, priority = 0, delay = 0) {
        try {
            score = new Date().getTime() + delay - priority;
            const pipeline = this.redisClient.pipeline();
            pipeline.zadd(`pop:queue:${name}`, score, identifier);
            pipeline.set(`pop:queue:${name}:${identifier}`, JSON.stringify(document));
            await pipeline.exec();
        } catch (e) {
            console.log(e);
        }
    }

    async pop(name) {
        try {
            let stringDocument = await this.redisClient.zpopmin(`pop:queue:${name}`, 1);
            let valueDcoument = await this.redisClient.get(`pop:queue:${name}:${stringDocument[0]}`);
            if (!valueDcoument || stringDocument.length == 0) {
                console.log("no document in redis");
                return null;
            }
            let document = parseDocFromRedis(valueDcoument);
            let pickedTime = new Date();
            document.pickedAt = pickedTime;
            await this.db.collection(this.getDbCollectionName(name)).findOneAndUpdate({
                identifier: document.identifier
            }, {
                $inc: {
                    attempts: 1
                },
                $set: {
                    pickedAt: new Date(pickedTime)
                }
            });
            return document;
        } catch(err) {
            console.log("error parsing doc from redis", err);
        }
    }

    async finish(document, name) {
        try {
            let finishTime = new Date();
            await this.db.collection(this.getDbCollectionName(document.name)).findOneAndUpdate({
                identifier: document.identifier
            }, {
                $set: {
                    finishedAt: finishTime,
                    duration: finishTime - document.pickedAt,
                    delay: finishTime - document.createdAt,
                    status: 'done'
                }
            });
            await this.redisClient.del(`pop:queue:${name}:${document.identifier}`);
            await this.notifySystems('jobFinished', document);
        } catch (e) {
            console.log(e)
        }
    }

    async fail(document, reason, force) {
        try {
            if (document.attempts >= this.retries && !force) {
                let finishTime = new Date();
                await this.db.collection(this.getDbCollectionName(document.name)).findOneAndUpdate({
                    identifier: document.identifier
                }, {
                    $push: {
                        failedReason: {
                            reason, 
                            time: new Date()
                        },
                    },
                    $set: {
                        finishedAt: finishTime,
                        status: 'failed',
                        requeuedAt: new Date()
                    }
                });
                await this.moveToDeadLetterQueue(document);
                await this.notifySystems('jobFailed', document);
            } else {
                let newDocument = await this.db.collection(this.getDbCollectionName(document.name)).findOneAndUpdate({
                    identifier: document.identifier
                }, {
                    $unset: {
                        pickedAt: 1,
                        finishedAt: 1,
                        status: 1,
                        duration: 1
                    },
                    $push: {
                        failedReason: {
                            reason, 
                            time: new Date()
                        },
                        runHistory: {
                            pickedAt: document.pickedAt,
                            finishedAt: document.finishedAt,
                            status: document.status,
                            duration: document.duration
                        }
                    },
                    $set: {
                        requeuedAt: new Date()
                    }
                }, {new: true});
                if(newDocument.value && newDocument.value.name) {
                    await sleep(2000);
                    await this.pushToQueue(newDocument.value, newDocument.value.name, newDocument.value.identifier);
                }
            }
        } catch (e) {
            console.log(e)
        }
    }

    async moveToDeadLetterQueue(document) {
        try {
            await this.db.collection('dead_letter_queue').insertOne(document);
        } catch (e) {
            console.log(e);
        }
    }

    async run(name) {
        let job = await this.pop(name);
        if (!job) {
            let error = new Error(`No job for ${name}`);
            error.code = 404;
            throw error;
        }
        try {
            if (this.runners[name] && this.runners[name].fn) {
                try {
                    let fnTimeout = setTimeout(() => {
                        throw new Error("Timeout");
                    }, (this.runners[name].options && this.runners[name].options.timeout) || 10 * 60 * 1000)
                    const isSuccess = await this.runners[name].fn(job);
                    if(isSuccess) {
                        await this.finish(job, name);
                    }
                    else{
                        await this.fail(job, "Failed");
                    }
                    clearTimeout(fnTimeout);
                } catch(err) {
                    await this.fail(job, err.toString());
                }
            } else {
                await this.fail(job, `Runner ${name} not defined`);
                throw new Error('Runner not defined');
            }
        } catch(e) {
            console.log(e);
        }
    }

    async getQueueLength(name) {
        return await this.redisClient.zcount(`pop:queue:${name}`, '-inf', '+inf');
    }

    async getCurrentQueue(name) {
        let docs =  await this.redisClient.zrange(`pop:queue:${name}`, 0 , - 1);
        docs = docs.filter(d => d).map(d => parseDocFromRedis(d));
        return docs
    }

    async getCountInLastNHours(name, n) {
        let startTime = new Date(Date.now() - n * 60 * 60 * 1000);
        let oId = objectId.createFromTime(startTime.getTime() / 1000);
        let filter = {
            _id: {
                $gte: oId.toString(),
            },
            name
        };
        let count = await this.db.collection(this.getDbCollectionName(name)).count(filter);
        return count;
    }

    async getPaginatedExecutedQueue(name, { lastNDays = 1, skip, limit, sort, search, status }) {
        let startOfNDay = new Date(Date.now() - lastNDays * 24 * 60 * 60 * 1000);
        startOfNDay.setUTCHours(0,0,0,0);
        let oId = objectId.createFromTime(startOfNDay.getTime() / 1000);
        let filter = {
            _id: {
                $gte: oId.toString(),
            },
            name
        };

        if (status === "failed") {
            filter.status = status
        }
        let docs = await this.db.collection(this.getDbCollectionName(name)).find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .toArray();
        return docs
    }

    async requeueJob(name, documentId) {
        try {
            let doc = await this.db.collection(this.getDbCollectionName(name)).findOne({
                _id: documentId
            });
            await this.fail(doc, "Unknown, manually Requeued", true)
        } catch(e) {
            console.log(e);
        }
    }

    async scheduleRecurringJob(name, cronExpression, jobData, identifier, priority = 0) {
        cron.schedule(cronExpression, async () => {
            await this.now(jobData, name, identifier, Date.now(), priority);
        });
    }

    async addPlugin(plugin) {
        this.plugins.push(plugin);
    }

    async emitEvent(event, data) {
        if (this.eventHooks[event]) {
            for (let hook of this.eventHooks[event]) {
                await hook(data);
            }
        }
    }

    async on(event, hook) {
        if (!this.eventHooks[event]) {
            this.eventHooks[event] = [];
        }
        this.eventHooks[event].push(hook);
    }

    async notifySystems(event, data) {
        if (this.notificationConfig.webhook) {
            await axios.post(this.notificationConfig.webhook.url, {
                event,
                data
            });
        }

        if (this.notificationConfig.email) {
            let transporter = nodemailer.createTransport(this.notificationConfig.email.smtpConfig);
            await transporter.sendMail({
                from: this.notificationConfig.email.from,
                to: this.notificationConfig.email.to,
                subject: `Notification: ${event}`,
                text: JSON.stringify(data, null, 2)
            });
        }

        if (this.notificationConfig.slack) {
            const slackClient = new WebClient(this.notificationConfig.slack.token);
            await slackClient.chat.postMessage({
                channel: this.notificationConfig.slack.channel,
                text: `Notification: ${event}\n${JSON.stringify(data, null, 2)}`
            });
        }
    }
}

module.exports = {
    PopQueue
};
