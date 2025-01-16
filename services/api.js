const express = require('express');
const cors = require('cors');
const { PopQueue } = require('../pop-queue/index');
const queue = require('./queue');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const winston = require('winston');

const app = express();
const port = 3210;

// Configure logging
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

// Enable CORS
app.use(cors());

app.use(express.json());

app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

app.get('/api/job-details', async (req, res) => {
    try {
        const jobDetails = await queue.getAllJobsPaginated({skip: 0, limit: 10});
        res.json(jobDetails);
    } catch (error) {
        logger.error('Error fetching job details:', error);
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
        logger.error('Error requeuing job:', error);
        res.status(500).json({ error: 'Failed to requeue job' });
    }
});

app.post('/api/register-worker', async (req, res) => {
    try {
        await queue.registerWorker();
        res.status(200).json({ message: 'Worker registered successfully' });
    } catch (error) {
        logger.error('Error registering worker:', error);
        res.status(500).json({ error: 'Failed to register worker' });
    }
});

app.post('/api/deregister-worker', async (req, res) => {
    try {
        await queue.deregisterWorker();
        res.status(200).json({ message: 'Worker deregistered successfully' });
    } catch (error) {
        logger.error('Error deregistering worker:', error);
        res.status(500).json({ error: 'Failed to deregister worker' });
    }
});

app.post('/api/redistribute-jobs', async (req, res) => {
    try {
        await queue.redistributeJobs();
        res.status(200).json({ message: 'Jobs redistributed successfully' });
    } catch (error) {
        logger.error('Error redistributing jobs:', error);
        res.status(500).json({ error: 'Failed to redistribute jobs' });
    }
});

app.post('/api/now', async (req, res) => {
    try {
        const { jobData, jobName, jobIdentifier, jobScore, priority, delay } = req.body;
        if (!jobData || !jobName || !jobIdentifier || !jobScore) {
            return res.status(400).json({ error: 'Invalid or missing job data' });
        }
        await queue.now(jobData, jobName, jobIdentifier, jobScore, priority, delay);
        res.status(200).json({ message: 'Job enqueued successfully' });
    } catch (error) {
        logger.error('Error enqueuing job:', error);
        res.status(500).json({ error: 'Failed to enqueue job' });
    }
});

app.post('/api/start-loop', async (req, res) => {
    try {
        await queue.startLoop();
        res.status(200).json({ message: 'Loop started successfully' });
    } catch (error) {
        logger.error('Error starting loop:', error);
        res.status(500).json({ error: 'Failed to start loop' });
    }
});

app.post('/api/fail', async (req, res) => {
    try {
        const { jobData, reason, force } = req.body;
        if (!jobData || !reason) {
            return res.status(400).json({ error: 'Invalid or missing job data or reason' });
        }
        await queue.fail(jobData, reason, force);
        res.status(200).json({ message: 'Job failed successfully' });
    } catch (error) {
        logger.error('Error failing job:', error);
        res.status(500).json({ error: 'Failed to fail job' });
    }
});

app.post('/api/emit-event', async (req, res) => {
    try {
        const { event, data } = req.body;
        if (!event || !data) {
            return res.status(400).json({ error: 'Invalid or missing event or data' });
        }
        await queue.emitEvent(event, data);
        res.status(200).json({ message: 'Event emitted successfully' });
    } catch (error) {
        logger.error('Error emitting event:', error);
        res.status(500).json({ error: 'Failed to emit event' });
    }
});

app.post('/api/on', async (req, res) => {
    try {
        const { event, hook } = req.body;
        if (!event || !hook) {
            return res.status(400).json({ error: 'Invalid or missing event or hook' });
        }
        await queue.on(event, hook);
        res.status(200).json({ message: 'Event listener registered successfully' });
    } catch (error) {
        logger.error('Error registering event listener:', error);
        res.status(500).json({ error: 'Failed to register event listener' });
    }
});

app.post('/api/run', async (req, res) => {
    try {
        const { jobName, jobIdentifier, jobData } = req.body;
        if (!jobName || !jobIdentifier || !jobData) {
            return res.status(400).json({ error: 'Invalid or missing job data' });
        }
        await queue.run(jobName, jobIdentifier, jobData);
        res.status(200).json({ message: 'Job run successfully' });
    } catch (error) {
        logger.error('Error running job:', error);
        res.status(500).json({ error: 'Failed to run job' });
    }
});

app.post('/api/job-progress', async (req, res) => {
    try {
        const { jobId, progress } = req.body;
        if (!jobId || typeof progress !== 'number') {
            return res.status(400).json({ error: 'Invalid or missing jobId or progress' });
        }
        await queue.progress(jobId, progress);
        res.status(200).json({ message: 'Job progress updated successfully' });
    } catch (error) {
        logger.error('Error updating job progress:', error);
        res.status(500).json({ error: 'Failed to update job progress' });
    }
});

app.post('/api/job-completion-callback', async (req, res) => {
    try {
        const { jobId, callbackUrl } = req.body;
        if (!jobId || !callbackUrl) {
            return res.status(400).json({ error: 'Invalid or missing jobId or callbackUrl' });
        }
        await queue.completionCallback(jobId, callbackUrl);
        res.status(200).json({ message: 'Job completion callback registered successfully' });
    } catch (error) {
        logger.error('Error registering job completion callback:', error);
        res.status(500).json({ error: 'Failed to register job completion callback' });
    }
});

app.post('/api/validate-job-data', async (req, res) => {
    try {
        const { jobName, jobData } = req.body;
        if (!jobName || !jobData) {
            return res.status(400).json({ error: 'Invalid or missing jobName or jobData' });
        }
        await queue.validateJobData(jobName, jobData);
        res.status(200).json({ message: 'Job data validated successfully' });
    } catch (error) {
        logger.error('Error validating job data:', error);
        res.status(500).json({ error: 'Failed to validate job data' });
    }
});

app.post('/api/check-job-dependencies', async (req, res) => {
    try {
        const { jobName } = req.body;
        if (!jobName) {
            return res.status(400).json({ error: 'Invalid or missing jobName' });
        }
        await queue.checkJobDependencies(jobName);
        res.status(200).json({ message: 'Job dependencies checked successfully' });
    } catch (error) {
        logger.error('Error checking job dependencies:', error);
        res.status(500).json({ error: 'Failed to check job dependencies' });
    }
});

app.get('/api/metrics', async (req, res) => {
    try {
        const metrics = await queue.getMetrics();
        res.json(metrics);
    } catch (error) {
        logger.error('Error fetching metrics:', error);
        res.status(500).json({ error: 'Failed to fetch metrics' });
    }
});

app.post('/api/schedule-recurring-job', async (req, res) => {
    try {
        const { jobName, cronExpression, jobData, identifier, priority } = req.body;
        if (!jobName || !cronExpression || !jobData || !identifier) {
            return res.status(400).json({ error: 'Invalid or missing job data' });
        }
        await queue.scheduleRecurringJob(jobName, cronExpression, jobData, identifier, priority);
        res.status(200).json({ message: 'Recurring job scheduled successfully' });
    } catch (error) {
        logger.error('Error scheduling recurring job:', error);
        res.status(500).json({ error: 'Failed to schedule recurring job' });
    }
});

app.post('/api/handle-job-failure', async (req, res) => {
    try {
        const { jobData, reason, force } = req.body;
        if (!jobData || !reason) {
            return res.status(400).json({ error: 'Invalid or missing job data or reason' });
        }
        await queue.fail(jobData, reason, force);
        res.status(200).json({ message: 'Job failure handled successfully' });
    } catch (error) {
        logger.error('Error handling job failure:', error);
        res.status(500).json({ error: 'Failed to handle job failure' });
    }
});

app.post('/api/notify-job-event', async (req, res) => {
    try {
        const { event, data } = req.body;
        if (!event || !data) {
            return res.status(400).json({ error: 'Invalid or missing event or data' });
        }
        await queue.notifySystems(event, data);
        res.status(200).json({ message: 'Job event notification sent successfully' });
    } catch (error) {
        logger.error('Error sending job event notification:', error);
        res.status(500).json({ error: 'Failed to send job event notification' });
    }
});

app.post('/api/add-plugin', async (req, res) => {
    try {
        const { plugin } = req.body;
        if (!plugin) {
            return res.status(400).json({ error: 'Invalid or missing plugin' });
        }
        await queue.addPlugin(plugin);
        res.status(200).json({ message: 'Plugin added successfully' });
    } catch (error) {
        logger.error('Error adding plugin:', error);
        res.status(500).json({ error: 'Failed to add plugin' });
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
        .catch(error => {
            logger.error('Error fetching job details:', error);
            callback(error);
        });
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
        .catch(error => {
            logger.error('Error requeuing job:', error);
            callback(error);
        });
}

function registerWorker(call, callback) {
    queue.registerWorker()
        .then(() => callback(null, { message: 'Worker registered successfully' }))
        .catch(error => {
            logger.error('Error registering worker:', error);
            callback(error);
        });
}

function deregisterWorker(call, callback) {
    queue.deregisterWorker()
        .then(() => callback(null, { message: 'Worker deregistered successfully' }))
        .catch(error => {
            logger.error('Error deregistering worker:', error);
            callback(error);
        });
}

function redistributeJobs(call, callback) {
    queue.redistributeJobs()
        .then(() => callback(null, { message: 'Jobs redistributed successfully' }))
        .catch(error => {
            logger.error('Error redistributing jobs:', error);
            callback(error);
        });
}

// Implement the gRPC service
const server = new grpc.Server();
server.addService(popqueueProto.PopQueueService.service, {
    GetJobDetails: async (call, callback) => {
        try {
            const jobDetails = await queue.getCurrentQueue(call.request.jobName);
            callback(null, { jobs: jobDetails });
        } catch (error) {
            logger.error('Error fetching job details:', error);
            callback(error);
        }
    }
});

// Start the gRPC server
const grpcPort = 50051;
server.bindAsync(`0.0.0.0:${grpcPort}`, grpc.ServerCredentials.createInsecure(), () => {
    console.log(`gRPC server running at http://0.0.0.0:${grpcPort}`);
    server.start();
});

app.listen(port, () => {
    console.log(`REST server running at http://localhost:${port}`);
});