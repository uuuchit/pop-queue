# Error Handling

## Error Handling in API Endpoints

### General Error Handling

All API endpoints in `pop-queue` follow a consistent error handling approach. Errors are logged using the `winston` logging library and appropriate HTTP status codes are returned to the client.

### Example: Fetching Job Details

**Endpoint:** `GET /api/job-details`

**Error Handling:**
- If an error occurs while fetching job details, a `500 Internal Server Error` status code is returned along with an error message.

**Code:**
```javascript
app.get('/api/job-details', async (req, res) => {
    try {
        const jobDetails = await queue.getCurrentQueue('myJob');
        res.json(jobDetails);
    } catch (error) {
        logger.error('Error fetching job details:', error);
        res.status(500).json({ error: 'Failed to fetch job details' });
    }
});
```

### Example: Requeuing a Job

**Endpoint:** `POST /api/requeue-job`

**Error Handling:**
- If the `jobId` is missing or invalid, a `400 Bad Request` status code is returned.
- If an error occurs while requeuing the job, a `500 Internal Server Error` status code is returned along with an error message.

**Code:**
```javascript
app.post('/api/requeue-job', async (req, res) => {
    try {
        const { jobId } = req.body;
        if (!jobId || typeof jobId !== 'string') {
            return res.status(400).json({ error: 'Invalid or missing jobId' });
        }
        await queue.requeueJob('myJob', jobId);
        res.status(200).json({ message: 'Job requeued successfully' });
    } catch (error) {
        logger.error('Error requeuing job:', error);
        res.status(500).json({ error: 'Failed to requeue job' });
    }
});
```

### Example: Registering a Worker

**Endpoint:** `POST /api/register-worker`

**Error Handling:**
- If an error occurs while registering the worker, a `500 Internal Server Error` status code is returned along with an error message.

**Code:**
```javascript
app.post('/api/register-worker', async (req, res) => {
    try {
        await queue.registerWorker();
        res.status(200).json({ message: 'Worker registered successfully' });
    } catch (error) {
        logger.error('Error registering worker:', error);
        res.status(500).json({ error: 'Failed to register worker' });
    }
});
```

### Example: Deregistering a Worker

**Endpoint:** `POST /api/deregister-worker`

**Error Handling:**
- If an error occurs while deregistering the worker, a `500 Internal Server Error` status code is returned along with an error message.

**Code:**
```javascript
app.post('/api/deregister-worker', async (req, res) => {
    try {
        await queue.deregisterWorker();
        res.status(200).json({ message: 'Worker deregistered successfully' });
    } catch (error) {
        logger.error('Error deregistering worker:', error);
        res.status(500).json({ error: 'Failed to deregister worker' });
    }
});
```

### Example: Redistributing Jobs

**Endpoint:** `POST /api/redistribute-jobs`

**Error Handling:**
- If an error occurs while redistributing jobs, a `500 Internal Server Error` status code is returned along with an error message.

**Code:**
```javascript
app.post('/api/redistribute-jobs', async (req, res) => {
    try {
        await queue.redistributeJobs();
        res.status(200).json({ message: 'Jobs redistributed successfully' });
    } catch (error) {
        logger.error('Error redistributing jobs:', error);
        res.status(500).json({ error: 'Failed to redistribute jobs' });
    }
});
```

## Error Handling in Queue Operations

### General Error Handling

Errors that occur during queue operations are logged using the `winston` logging library. The queue operations are designed to handle errors gracefully and ensure that the system remains stable.

### Example: Enqueuing a Job

**Operation:** `queue.now`

**Error Handling:**
- If an error occurs while enqueuing a job, the error is logged and the job is not added to the queue.

**Code:**
```javascript
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
```

### Example: Running a Job

**Operation:** `queue.run`

**Error Handling:**
- If an error occurs while running a job, the error is logged and the job is marked as failed.

**Code:**
```javascript
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
```

### Example: Failing a Job

**Operation:** `queue.fail`

**Error Handling:**
- If an error occurs while failing a job, the error is logged and the job is not moved to the dead letter queue.

**Code:**
```javascript
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
```

### Example: Moving a Job to Dead Letter Queue

**Operation:** `queue.moveToDeadLetterQueue`

**Error Handling:**
- If an error occurs while moving a job to the dead letter queue, the error is logged and the job is not moved.

**Code:**
```javascript
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
```
