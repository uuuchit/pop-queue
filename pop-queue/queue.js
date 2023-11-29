
const { mongoClient, objectId } = require('./mongo.js');
const { redisClient } = require('./redis.js');
const { sleep, parseDocFromRedis } = require('./helpers.js');

class PopQueue {

    constructor(dbUrl, redis, dbName, cName, retries) {
        this.dbUrl = dbUrl;
        this.redis = redis;
        this.cName = cName || "pop_queues";
        this.dbName = dbName || "circle";
        this.retries = retries || 3;
        this.runners = {};
        this.loopRunning = false;
    }

    async define(name, fn, options = {}) {
        this.runners[name] = {
            fn,
            options,
            cName: options.cName || "pop_queues"
        };
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
            // console.log("Loop initiating");
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
                    //console.log("Loop breaking");
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
        } catch(e) {
            console.log(e);        
        }
    }

    async connectRedis() {
        try {
            this.redisClient =  await redisClient(this.redis);
            console.log('redis connected');
        } catch(e) {
            console.log(e);        
        }
    }

    async now(job, name,  identifier, score) {
        try {
            let document = {data: job, createdAt: new Date(), name, identifier};
            if (!this.db) {
                await this.connect();
                console.log("Connected Db");
            }
            await this.db.collection(this.getDbCollectionName(name)).findOneAndUpdate({identifier}, {$set: document}, {upsert: true});
            await this.pushToQueue(document, name, identifier, score);
        } catch(e) {
            console.log(e);        
        }
    }

    async pushToQueue(document, name, identifier, score) {
        try {
            // if(!score){
                score = new Date().getTime();
            // }
            await this.redisClient.zadd(`pop:queue:${name}`,score, identifier);
            await this.redisClient.set(`pop:queue:${name}:${identifier}`, JSON.stringify(document));
        } catch (e) {
            console.log(e);
        }
    }

    async pop(name) {
        try {
            let stringDocument = await this.redisClient.zpopmin(`pop:queue:${name}`, 1);
            //console.log("data from redis", stringDocument);
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
        } catch(e) {
            console.log(e);        
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
}

module.exports = {
    PopQueue
};
