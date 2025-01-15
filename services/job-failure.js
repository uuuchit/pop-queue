const { sleep } = require('../utils/helpers');
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

async function failJob(document, reason, force, db, dbUrl, retries, redisClient, redlock) {
    try {
        if (document.attempts >= retries && !force) {
            let finishTime = new Date();
            if (dbUrl.startsWith('postgres://')) {
                const updateQuery = `
                    UPDATE ${document.cName}
                    SET finishedAt = $1, status = 'failed', requeuedAt = $2, failedReason = COALESCE(failedReason, '[]'::jsonb) || $3::jsonb
                    WHERE identifier = $4;
                `;
                await db.query(updateQuery, [finishTime, new Date(), JSON.stringify({ reason, time: new Date() }), document.identifier]);
            } else {
                await db.collection(document.cName).findOneAndUpdate({
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
            await moveToDeadLetterQueue(document, db, dbUrl);
            await notifySystems('jobFailed', document);
            this.metrics.jobsFailed++;
            this.emit('jobFailed', document);
        } else {
            if (dbUrl.startsWith('postgres://')) {
                const updateQuery = `
                    UPDATE ${document.cName}
                    SET pickedAt = NULL, finishedAt = NULL, status = NULL, duration = NULL, requeuedAt = $1,
                    failedReason = COALESCE(failedReason, '[]'::jsonb) || $2::jsonb,
                    runHistory = COALESCE(runHistory, '[]'::jsonb) || $3::jsonb
                    WHERE identifier = $4
                    RETURNING *;
                `;
                const result = await db.query(updateQuery, [new Date(), JSON.stringify({ reason, time: new Date() }), JSON.stringify({
                    pickedAt: document.pickedAt,
                    finishedAt: document.finishedAt,
                    status: document.status,
                    duration: document.duration
                }), document.identifier]);
                const newDocument = result.rows[0];
                if (newDocument) {
                    await sleep(2000);
                    await pushToQueue(newDocument, newDocument.name, newDocument.identifier, redisClient, redlock);
                }
            } else {
                let newDocument = await db.collection(document.cName).findOneAndUpdate({
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
                    await pushToQueue(newDocument.value, newDocument.value.name, newDocument.value.identifier, redisClient, redlock);
                }
            }
        }
    } catch (e) {
        console.log(e);
        logger.error('Error failing job:', e);
    }
}

async function moveToDeadLetterQueue(document, db, dbUrl) {
    try {
        if (dbUrl.startsWith('postgres://')) {
            const insertQuery = `
                INSERT INTO dead_letter_queue (data, createdAt, name, identifier, priority, delay, pickedAt, finishedAt, attempts, status, duration, requeuedAt, failedReason, runHistory)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);
            `;
            await db.query(insertQuery, [document.data, document.createdAt, document.name, document.identifier, document.priority, document.delay, document.pickedAt, document.finishedAt, document.attempts, document.status, document.duration, document.requeuedAt, document.failedReason, document.runHistory]);
        } else {
            await db.collection('dead_letter_queue').insertOne(document);
        }
    } catch (e) {
        console.log(e);
        logger.error('Error moving job to dead letter queue:', e);
    }
}

async function pushToQueue(document, name, identifier, redisClient, redlock) {
    try {
        const lock = await redlock.lock(`locks:pop:queue:${name}`, 1000);
        const score = new Date().getTime() + document.delay - document.priority;
        const pipeline = redisClient.pipeline();
        pipeline.zadd(`pop:queue:${name}`, score, identifier);
        pipeline.set(`pop:queue:${name}:${identifier}`, JSON.stringify(document));
        await pipeline.exec();
        await lock.unlock();
    } catch (e) {
        console.log(e);
        logger.error('Error pushing job to queue:', e);
    }
}

module.exports = {
    failJob,
    moveToDeadLetterQueue,
    pushToQueue
};
