const { sleep, parseDocFromRedis } = require('../utils/helpers.js');
const winston = require('winston');
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

async function pushToQueue(redisClient, document, name, identifier, score, priority = 0, delay = 0) {
    try {
        score = new Date().getTime() + delay - priority;
        const pipeline = this.redisClient.pipeline();
        pipeline.zadd(`pop:queue:${name}`, score, identifier);
        pipeline.set(`pop:queue:${name}:${identifier}`, JSON.stringify(document));
        await pipeline.exec();
    } catch (e) {
        console.log(e);
        logger.error('Error pushing job to queue:', e);
    }
}

async function pushToBatchQueue(redisClient, documents, name) {
    try {
        const pipeline = this.redisClient.pipeline();
        for (const document of documents) {
            const { identifier, priority = 0, delay = 0 } = document;
            const score = new Date().getTime() + delay - priority;
            pipeline.zadd(`pop:queue:${name}`, score, identifier);
            pipeline.set(`pop:queue:${name}:${identifier}`, JSON.stringify(document));
        }
        await pipeline.exec();
    } catch (e) {
        console.log(e);
        logger.error('Error pushing batch of jobs to queue:', e);
    }
}

async function popBatch(redisClient, redlock, name, batchSize) {
    try {
        console.log("popBatch", name, batchSize);
        const pipeline = this.redisClient.pipeline();
        
        for (let i = 0; i < batchSize; i++) {
            console.log("pop:queue:", name);
            pipeline.zpopmin(`pop:queue:${name}`, 1);
        }
        const results = await pipeline.exec();
        const jobs = [];
        console.log("results", results);
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
        return jobs;
    } catch(err) {
        console.log("error parsing doc from redis", err);
        logger.error('Error popping batch from queue:', err);
    }
}

async function pop(redisClient, redlock, name) {
    try {
        let stringDocument = await this.redisClient.zpopmin(`pop:queue:${name}`, 1);
        if (stringDocument.length === 0) {
            console.log("no document in redis");
            return null;
        }
        let valueDocument = await this.redisClient.get(`pop:queue:${name}:${stringDocument[0]}`);
        if (!valueDocument) {
            console.log("no document in redis");
            return null;
        }
        let document = parseDocFromRedis(valueDocument);
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
        return document;
    } catch(err) {
        console.log("error parsing doc from redis", err);
        logger.error('Error popping job from queue:', err);
    }
}

async function finish(db, redisClient, document, name) {
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
        this.metrics.jobsSucceeded++;
        this.metrics.jobDuration.push(finishTime - document.pickedAt);
        this.emit('jobFinished', document);
        if (this.runners[name] && this.runners[name].options && this.runners[name].options.completionCallback) {
            this.runners[name].options.completionCallback(document);
        }
    } catch (e) {
        console.log(e);
        logger.error('Error finishing job:', e);
    }
}

async function fail(db, redisClient, document, reason, force) {
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
            await moveToDeadLetterQueue(document, db, this.dbUrl, logger);
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
                    await pushToQueue(redisClient, newDocument, newDocument.name, newDocument.identifier);
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
                if(newDocument && newDocument.value && newDocument.value.name) {
                    await sleep(2000);
                    await pushToQueue(redisClient, newDocument.value, newDocument.value.name, newDocument.value.identifier);
                }
            }
        }
    } catch (e) {
        console.log(e);
        logger.error('Error failing job:', e);
    }
}

async function moveToDeadLetterQueue(document, db, dbUrl, logger) {
    try {
        if (dbUrl.startsWith('postgres://')) {
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
        logger.error('Error moving job to dead letter queue:', e);
    }
}

module.exports = {
    pushToQueue,
    pushToBatchQueue,
    popBatch,
    pop,
    finish,
    fail,
    moveToDeadLetterQueue
};
