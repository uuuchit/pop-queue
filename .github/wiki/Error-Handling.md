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
        this.logger.error('Error running job:', e);
    }
}
```
