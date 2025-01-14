const express = require('express');
const { PopQueue } = require('./queue');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

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

app.post('/api/now', async (req, res) => {
    try {
        const { jobData, jobName, jobIdentifier, jobScore, priority, delay } = req.body;
        await queue.now(jobData, jobName, jobIdentifier, jobScore, priority, delay);
        res.status(200).json({ message: 'Job enqueued successfully' });
    } catch (error) {
        console.error('Error enqueuing job:', error);
        res.status(500).json({ error: 'Failed to enqueue job' });
    }
});

app.post('/api/start-loop', async (req, res) => {
    try {
        await queue.startLoop();
        res.status(200).json({ message: 'Loop started successfully' });
    } catch (error) {
        console.error('Error starting loop:', error);
        res.status(500).json({ error: 'Failed to start loop' });
    }
});

app.post('/api/fail', async (req, res) => {
    try {
        const { jobData, reason, force } = req.body;
        await queue.fail(jobData, reason, force);
        res.status(200).json({ message: 'Job failed successfully' });
    } catch (error) {
        console.error('Error failing job:', error);
        res.status(500).json({ error: 'Failed to fail job' });
    }
});

app.post('/api/emit-event', async (req, res) => {
    try {
        const { event, data } = req.body;
        await queue.emitEvent(event, data);
        res.status(200).json({ message: 'Event emitted successfully' });
    } catch (error) {
        console.error('Error emitting event:', error);
        res.status(500).json({ error: 'Failed to emit event' });
    }
});

app.post('/api/on', async (req, res) => {
    try {
        const { event, hook } = req.body;
        await queue.on(event, hook);
        res.status(200).json({ message: 'Event listener registered successfully' });
    } catch (error) {
        console.error('Error registering event listener:', error);
        res.status(500).json({ error: 'Failed to register event listener' });
    }
});

app.post('/api/run', async (req, res) => {
    try {
        const { jobName, jobIdentifier, jobData } = req.body;
        await queue.run(jobName, jobIdentifier, jobData);
        res.status(200).json({ message: 'Job run successfully' });
    } catch (error) {
        console.error('Error running job:', error);
        res.status(500).json({ error: 'Failed to run job' });
    }
});

// gRPC server setup
const PROTO_PATH = path.resolve(__dirname, 'popqueue.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const popqueueProto = grpc.loadPackageDefinition(packageDefinition).popqueue;

function getJobDetails(call, callback) {
    queue.getCurrentQueue('myJob')
        .then(jobDetails => callback(null, { jobDetails }))
        .catch(error => callback(error));
}

function requeueJob(call, callback) {
    const jobId = call.request.jobId;
    if (!jobId || typeof jobId !== 'string') {
        return callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: 'Invalid or missing jobId'
        });
    }
    queue.requeueJob('myJob', jobId)
        .then(() => callback(null, { message: 'Job requeued successfully' }))
        .catch(error => callback(error));
}

function registerWorker(call, callback) {
    queue.registerWorker()
        .then(() => callback(null, { message: 'Worker registered successfully' }))
        .catch(error => callback(error));
}

function deregisterWorker(call, callback) {
    queue.deregisterWorker()
        .then(() => callback(null, { message: 'Worker deregistered successfully' }))
        .catch(error => callback(error));
}

function redistributeJobs(call, callback) {
    queue.redistributeJobs()
        .then(() => callback(null, { message: 'Jobs redistributed successfully' }))
        .catch(error => callback(error));
}

const server = new grpc.Server();
server.addService(popqueueProto.PopQueue.service, {
    getJobDetails,
    requeueJob,
    registerWorker,
    deregisterWorker,
    redistributeJobs
});
server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), () => {
    server.start();
    console.log('gRPC server running at http://0.0.0.0:50051');
});

app.listen(port, () => {
    console.log(`REST server running at http://localhost:${port}`);
});
