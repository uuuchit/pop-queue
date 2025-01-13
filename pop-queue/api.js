const express = require('express');
const { PopQueue } = require('./queue');

const app = express();
const port = 3000;

const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);

app.use(express.json());

app.get('/api/job-details', async (req, res) => {
    try {
        const jobDetails = await queue.getCurrentQueue('myJob');
        res.json(jobDetails);
    } catch (error) {
        console.error('Error fetching job details:', error);
        res.status(500).json({ error: 'Failed to fetch job details' });
    }
});

app.post('/api/requeue-job', async (req, res) => {
    try {
        const { jobId } = req.body;
        if (!jobId || typeof jobId !== 'string') {
            return res.status(400).json({ error: 'Invalid or missing jobId' });
        }
        await queue.requeueJob('myJob', jobId);
        res.status(200).json({ message: 'Job requeued successfully' });
    } catch (error) {
        console.error('Error requeuing job:', error);
        res.status(500).json({ error: 'Failed to requeue job' });
    }
});

app.post('/api/register-worker', async (req, res) => {
    try {
        await queue.registerWorker();
        res.status(200).json({ message: 'Worker registered successfully' });
    } catch (error) {
        console.error('Error registering worker:', error);
        res.status(500).json({ error: 'Failed to register worker' });
    }
});

app.post('/api/deregister-worker', async (req, res) => {
    try {
        await queue.deregisterWorker();
        res.status(200).json({ message: 'Worker deregistered successfully' });
    } catch (error) {
        console.error('Error deregistering worker:', error);
        res.status(500).json({ error: 'Failed to deregister worker' });
    }
});

app.post('/api/redistribute-jobs', async (req, res) => {
    try {
        await queue.redistributeJobs();
        res.status(200).json({ message: 'Jobs redistributed successfully' });
    } catch (error) {
        console.error('Error redistributing jobs:', error);
        res.status(500).json({ error: 'Failed to redistribute jobs' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
