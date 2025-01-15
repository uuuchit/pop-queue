const { mongoClient, objectId } = require('./mongo.js');
const { redisClient } = require('./redis.js');
const { memcachedClient } = require('./memcached.js');
const { postgresClient } = require('./postgres.js');
const { sleep, parseDocFromRedis } = require('./helpers.js');
const Redlock = require('redlock');
const config = require('./config');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { WebClient } = require('@slack/web-api');
const axios = require('axios');
const Ajv = require('ajv');
const EventEmitter = require('events');
const winston = require('winston');

class PopQueue extends EventEmitter {

    constructor(dbUrl, redis, dbName, cName, retries, mongoShardConfig = null, redisClusterConfig = null, workerId = null, memcachedUrl = null, postgresUrl = null) {
        super();
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
        this.workerId = workerId || `worker-${Math.random().toString(36).substr(2, 9)}`;
        this.workerTimeout = config.workerTimeout || 30000;
        this.memcachedUrl = memcachedUrl || config.memcachedUrl;
        this.postgresUrl = postgresUrl || config.postgresUrl;
        this.ajv = new Ajv();
        this.jobSchemas = {};
        this.jobDependencies = {};
        this.metrics = {
            jobsProcessed: 0,
            jobsFailed: 0,
            jobsSucceeded: 0,
            jobDuration: []
        };

        // Configure logging
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.json(),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ filename: 'error.log', level: 'error' }),
                new winston.transports.File({ filename: 'combined.log' })
            ]
        });

        // Configuration options for batch size, parallel execution, and Redis pipelining
        this.batchSize = config.batchSize || 1000;
        this.parallelExecution = config.parallelExecution || true;
        this.redisPipelining = config.redisPipelining || true;
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
        if (options.schema) {
            this.jobSchemas[name] = options.schema;
        }
        if (options.dependencies) {
            this.jobDependencies[name] = options.dependencies;
        }
    }

    async start(runLoop) {
        await this.registerWorker();
        await this.startLoop();
        setInterval(async () => {
            if (!this.loopRunning) {
                await this.startLoop();
            }
        }, 1000)
        this.startHeartbeat();
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
            if (this.dbUrl.startsWith('postgres://')) {
                this.db = await postgresClient(this.dbUrl);
                console.log('PostgreSQL connected');
                await this.setupPostgresSchema();
            } else {
                this.db = await mongoClient(this.dbUrl, this.dbName);
                console.log('MongoDB connected');
                if (this.mongoShardConfig) {
                    await this.db.admin().command({ enableSharding: this.dbName });
                    await this.db.admin().command({ shardCollection: `${this.dbName}.${this.cName}`, key: this.mongoShardConfig });
                    console.log('MongoDB sharding enabled');
                }
            }
        } catch (e) {
            console.log(e);
            this.logger.error('Error connecting to database:', e);
        }
    }

    async connectRedis() {
        try {
            if (this.redisClusterConfig) {
                this.redisClient = new Redis.Cluster(this.redisClusterConfig);
                console.log('Redis cluster connected');
            } else if (this.redis.startsWith('memcached://')) {
                this.redisClient = await memcachedClient(this.redis);
                console.log('Memcached connected');
            } else {
                this.redisClient = await redisClient(this.redis);
                console.log('Redis connected');
            }
            this.redlock = new Redlock([this.redisClient], {
                retryCount: 10,
                retryDelay: 200
            });
        } catch (e) {
            console.log(e);
            this.logger.error('Error connecting to Redis:', e);
        }
    }

    async setupPostgresSchema() {
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS ${this.cName} (
                id SERIAL PRIMARY KEY,
                data JSONB,
                createdAt TIMESTAMP,
                name VARCHAR(255),
                identifier VARCHAR(255) UNIQUE,
                priority INT,
                delay INT,
                pickedAt TIMESTAMP,
                finishedAt TIMESTAMP,
                attempts INT DEFAULT 0,
                status VARCHAR(50),
                duration INT,
                requeuedAt TIMESTAMP,
                failedReason JSONB,
                runHistory JSONB
            );
        `;
        await this.db.query(createTableQuery);
    }

    async now(job, name, identifier, score, priority = 0, delay = 0) {
        try {
            let document = {data: job, createdAt: new Date(), name, identifier, priority, delay};
            if (!this.db) {
                await this.connect();
                console.log("Connected Db");
            }
            if (this.dbUrl.startsWith('postgres://')) {
                const insertQuery = `
                    INSERT INTO ${this.cName} (data, createdAt, name, identifier, priority, delay)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (identifier) DO UPDATE SET
                    data = EXCLUDED.data,
                    createdAt = EXCLUDED.createdAt,
                    name = EXCLUDED.name,
                    priority = EXCLUDED.priority,
                    delay = EXCLUDED.delay;
                `;
                await this.db.query(insertQuery, [document.data, document.createdAt, document.name, document.identifier, document.priority, document.delay]);
            } else {
                await this.db.collection(this.getDbCollectionName(name)).findOneAndUpdate({identifier}, {$set: document}, {upsert: true});
            }
            await this.pushToQueue(document, name, identifier, score, priority, delay);
        } catch(e) {
            console.log(e);
            this.logger.error('Error enqueuing job:', e);
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
            this.logger.error('Error pushing job to queue:', e);
        }
    }

    async pop(name) {
        try {
            const lock = await this.redlock.lock(`locks:pop:queue:${name}`, 1000);
            let stringDocument = await this.redisClient.zpopmin(`pop:queue:${name}`, 1);
            let valueDcoument = await this.redisClient.get(`pop:queue:${name}:${stringDocument[0]}`);
            if (!valueDcoument || stringDocument.length == 0) {
                console.log("no document in redis");
                await lock.unlock();
                return null;
            }
            let document = parseDocFromRedis(valueDcoument);
            let pickedTime = new Date();
            document.pickedAt = pickedTime;
            if (this.dbUrl.startsWith('postgres://')) {
                const updateQuery = `
                    UPDATE ${this.cName}
                    SET attempts = attempts + 1, pickedAt = $1
                    WHERE identifier = $2;
                `;
                await this.db.query(updateQuery, [pickedTime, document.identifier]);
            } else {
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
            }
            await lock.unlock();
            return document;
        } catch(err) {
            console.log("error parsing doc from redis", err);
            this.logger.error('Error popping job from queue:', err);
        }
    }

    async finish(document, name) {
        try {
            let finishTime = new Date();
            if (this.dbUrl.startsWith('postgres://')) {
                const updateQuery = `
                    UPDATE ${this.cName}
                    SET finishedAt = $1, duration = $2, delay = $3, status = 'done'
                    WHERE identifier = $4;
                `;
                await this.db.query(updateQuery, [finishTime, finishTime - document.pickedAt, finishTime - document.createdAt, document.identifier]);
            } else {
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
            }
            await this.redisClient.del(`pop:queue:${name}:${document.identifier}`);
            await this.notifySystems('jobFinished', document);
            this.metrics.jobsSucceeded++;
            this.metrics.jobDuration.push(finishTime - document.pickedAt);
            this.emit('jobFinished', document);
        } catch (e) {
            console.log(e);
            this.logger.error('Error finishing job:', e);
        }
    }

    async fail(document, reason, force) {
        try {
            if (document.attempts >= this.retries && !force) {
                let finishTime = new Date();
                if (this.dbUrl.startsWith('postgres://')) {
                    const updateQuery = `
                        UPDATE ${this.cName}
                        SET finishedAt = $1, status = 'failed', requeuedAt = $2, failedReason = COALESCE(failedReason, '[]'::jsonb) || $3::jsonb
                        WHERE identifier = $4;
                    `;
                    await this.db.query(updateQuery, [finishTime, new Date(), JSON.stringify({ reason, time: new Date() }), document.identifier]);
                } else {
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
                }
                await this.moveToDeadLetterQueue(document);
                await this.notifySystems('jobFailed', document);
                this.metrics.jobsFailed++;
                this.emit('jobFailed', document);
            } else {
                if (this.dbUrl.startsWith('postgres://')) {
                    const updateQuery = `
                        UPDATE ${this.cName}
                        SET pickedAt = NULL, finishedAt = NULL, status = NULL, duration = NULL, requeuedAt = $1,
                        failedReason = COALESCE(failedReason, '[]'::jsonb) || $2::jsonb,
                        runHistory = COALESCE(runHistory, '[]'::jsonb) || $3::jsonb
                        WHERE identifier = $4
                        RETURNING *;
                    `;
                    const result = await this.db.query(updateQuery, [new Date(), JSON.stringify({ reason, time: new Date() }), JSON.stringify({
                        pickedAt: document.pickedAt,
                        finishedAt: document.finishedAt,
                        status: document.status,
                        duration: document.duration
                    }), document.identifier]);
                    const newDocument = result.rows[0];
                    if (newDocument) {
                        await sleep(2000);
                        await this.pushToQueue(newDocument, newDocument.name, newDocument.identifier);
                    }
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
            }
        } catch (e) {
            console.log(e);
            this.logger.error('Error failing job:', e);
        }
    }

    async moveToDeadLetterQueue(document) {
        try {
            if (this.dbUrl.startsWith('postgres://')) {
                const insertQuery = `
                    INSERT INTO dead_letter_queue (data, createdAt, name, identifier, priority, delay, pickedAt, finishedAt, attempts, status, duration, requeuedAt, failedReason, runHistory)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);
                `;
                await this.db.query(insertQuery, [document.data, document.createdAt, document.name, document.identifier, document.priority, document.delay, document.pickedAt, document.finishedAt, document.attempts, document.status, document.duration, document.requeuedAt, document.failedReason, document.runHistory]);
            } else {
                await this.db.collection('dead_letter_queue').insertOne(document);
            }
        } catch (e) {
            console.log(e);
            this.logger.error('Error moving job to dead letter queue:', e);
        }
    }

    async run(name) {
        let jobs = await this.popBatch(name, this.batchSize);
        if (!jobs.length) {
            let error = new Error(`No job for ${name}`);
            error.code = 404;
            throw error;
        }
        try {
            if (this.runners[name] && this.runners[name].fn) {
                const promises = jobs.map(async (job) => {
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
                });
                if (this.parallelExecution) {
                    await Promise.all(promises);
                } else {
                    for (const promise of promises) {
                        await promise;
                    }
                }
            } else {
                for (const job of jobs) {
                    await this.fail(job, `Runner ${name} not defined`);
                }
                throw new Error('Runner not defined');
            }
        } catch(e) {
            console.log(e);
            this.logger.error('Error running job:', e);
        }
    }

    async popBatch(name, batchSize) {
        try {
            const lock = await this.redlock.lock(`locks:pop:queue:${name}`, 1000);
            const pipeline = this.redisClient.pipeline();
            for (let i = 0; i < batchSize; i++) {
                pipeline.zpopmin(`pop:queue:${name}`, 1);
            }
            const results = await pipeline.exec();
            const jobs = [];
            for (const result of results) {
                const stringDocument = result[1];
                if (stringDocument.length === 0) {
                    continue;
                }
                const valueDocument = await this.redisClient.get(`pop:queue:${name}:${stringDocument[0]}`);
                if (!valueDocument) {
                    continue;
                }
                const document = parseDocFromRedis(valueDocument);
                let pickedTime = new Date();
                document.pickedAt = pickedTime;
                if (this.dbUrl.startsWith('postgres://')) {
                    const updateQuery = `
                        UPDATE ${this.cName}
                        SET attempts = attempts + 1, pickedAt = $1
                        WHERE identifier = $2;
                    `;
                    await this.db.query(updateQuery, [pickedTime, document.identifier]);
                } else {
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
                }
                jobs.push(document);
            }
            await lock.unlock();
            return jobs;
        } catch(err) {
            console.log("error parsing doc from redis", err);
            this.logger.error('Error popping batch from queue:', err);
        }
    }

    async getQueueLength(name) {
        try {
            return await this.redisClient.zcount(`pop:queue:${name}`, '-inf', '+inf');
        } catch (e) {
            console.log(e);
            this.logger.error('Error getting queue length:', e);
        }
    }

    async getCurrentQueue(name) {
        try {
            let docs =  await this.redisClient.zrange(`pop:queue:${name}`, 0 , - 1);
            docs = docs.filter(d => d).map(d => parseDocFromRedis(d));
            return docs;
        } catch (e) {
            console.log(e);
            this.logger.error('Error getting current queue:', e);
        }
    }

    async getCountInLastNHours(name, n) {
        try {
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
        } catch (e) {
            console.log(e);
            this.logger.error('Error getting count in last N hours:', e);
        }
    }

    async getPaginatedExecutedQueue(name, { lastNDays = 1, skip, limit, sort, search, status }) {
        try {
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
            return docs;
        } catch (e) {
            console.log(e);
            this.logger.error('Error getting paginated executed queue:', e);
        }
    }

    async requeueJob(name, documentId) {
        try {
            let doc = await this.db.collection(this.getDbCollectionName(name)).findOne({
                _id: documentId
            });
            await this.fail(doc, "Unknown, manually Requeued", true);
        } catch(e) {
            console.log(e);
            this.logger.error('Error requeuing job:', e);
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

    async registerWorker() {
        try {
            await this.redisClient.sadd('workers', this.workerId);
        } catch (e) {
            console.log(e);
            this.logger.error('Error registering worker:', e);
        }
    }

    async deregisterWorker() {
        try {
            await this.redisClient.srem('workers', this.workerId);
        } catch (e) {
            console.log(e);
            this.logger.error('Error deregistering worker:', e);
        }
    }

    async startHeartbeat() {
        setInterval(async () => {
            try {
                await this.redisClient.set(`worker:${this.workerId}:heartbeat`, Date.now(), 'PX', this.workerTimeout);
            } catch (e) {
                console.log(e);
                this.logger.error('Error starting heartbeat:', e);
            }
        }, this.workerTimeout / 2);
    }

    async redistributeJobs() {
        try {
            const workers = await this.redisClient.smembers('workers');
            if (workers.length === 0) {
                return;
            }

            const jobs = await this.getCurrentQueue('myJob');
            for (let job of jobs) {
                const workerIndex = Math.floor(Math.random() * workers.length);
                const workerId = workers[workerIndex];
                await this.pushToQueue(job, 'myJob', job.identifier, Date.now(), 0, 0);
            }
        } catch (e) {
            console.log(e);
            this.logger.error('Error redistributing jobs:', e);
        }
    }

    async validateJobData(name, data) {
        if (this.jobSchemas[name]) {
            const validate = this.ajv.compile(this.jobSchemas[name]);
            const valid = validate(data);
            if (!valid) {
                throw new Error(`Job data validation failed: ${JSON.stringify(validate.errors)}`);
            }
        }
    }

    async checkJobDependencies(name) {
        if (this.jobDependencies[name]) {
            for (let dependency of this.jobDependencies[name]) {
                const dependencyCount = await this.getQueueLength(dependency);
                if (dependencyCount > 0) {
                    throw new Error(`Job dependency not met: ${dependency}`);
                }
            }
        }
    }

    async getMetrics() {
        return this.metrics;
    }
}

module.exports = {
    PopQueue
};
