const request = require('supertest');
const express = require('express');
const { PopQueue } = require('../pop-queue/queue');
const api = require('./api');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const winston = require('winston');

jest.mock('../pop-queue/queue');

describe('API Endpoints', () => {
    let app;
    let queueMock;
    let grpcClient;
    let logger;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api', api);

        queueMock = new PopQueue();
        PopQueue.mockImplementation(() => queueMock);

        const PROTO_PATH = path.resolve(__dirname, '../pop-queue/popqueue.proto');
        const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true
        });
        const popqueueProto = grpc.loadPackageDefinition(packageDefinition).popqueue;

        grpcClient = new popqueueProto.PopQueue('localhost:50051', grpc.credentials.createInsecure());

        // Configure logging
        logger = winston.createLogger({
            level: 'info',
            format: winston.format.json(),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ filename: 'error.log', level: 'error' }),
                new winston.transports.File({ filename: 'combined.log' })
            ]
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('GET /api/job-details should return job details', async () => {
        const jobDetails = [{ id: 1, name: 'testJob' }];
        queueMock.getCurrentQueue.mockResolvedValue(jobDetails);

        const response = await request(app).get('/api/job-details');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(jobDetails);
        expect(queueMock.getCurrentQueue).toHaveBeenCalledWith('myJob');
    });

    test('POST /api/requeue-job should requeue a job', async () => {
        const jobId = 'testJobId';

        const response = await request(app)
            .post('/api/requeue-job')
            .send({ jobId });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Job requeued successfully' });
        expect(queueMock.requeueJob).toHaveBeenCalledWith('myJob', jobId);
    });

    test('GET /api/job-details should handle errors', async () => {
        queueMock.getCurrentQueue.mockRejectedValue(new Error('Failed to fetch job details'));

        const response = await request(app).get('/api/job-details');

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'Failed to fetch job details' });
    });

    test('POST /api/requeue-job should handle errors', async () => {
        const jobId = 'testJobId';
        queueMock.requeueJob.mockRejectedValue(new Error('Failed to requeue job'));

        const response = await request(app)
            .post('/api/requeue-job')
            .send({ jobId });

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'Failed to requeue job' });
    });

    test('gRPC GetJobDetails should return job details', (done) => {
        const jobDetails = [{ id: 1, name: 'testJob' }];
        queueMock.getCurrentQueue.mockResolvedValue(jobDetails);

        grpcClient.GetJobDetails({}, (error, response) => {
            expect(error).toBeNull();
            expect(response.jobDetails).toEqual(jobDetails);
            done();
        });
    });

    test('gRPC RequeueJob should requeue a job', (done) => {
        const jobId = 'testJobId';

        grpcClient.RequeueJob({ jobId }, (error, response) => {
            expect(error).toBeNull();
            expect(response.message).toBe('Job requeued successfully');
            expect(queueMock.requeueJob).toHaveBeenCalledWith('myJob', jobId);
            done();
        });
    });

    test('gRPC GetJobDetails should handle errors', (done) => {
        queueMock.getCurrentQueue.mockRejectedValue(new Error('Failed to fetch job details'));

        grpcClient.GetJobDetails({}, (error, response) => {
            expect(error).not.toBeNull();
            expect(error.message).toBe('Failed to fetch job details');
            done();
        });
    });

    test('gRPC RequeueJob should handle errors', (done) => {
        const jobId = 'testJobId';
        queueMock.requeueJob.mockRejectedValue(new Error('Failed to requeue job'));

        grpcClient.RequeueJob({ jobId }, (error, response) => {
            expect(error).not.toBeNull();
            expect(error.message).toBe('Failed to requeue job');
            done();
        });
    });

    test('POST /api/now should enqueue a job with priority and delay', async () => {
        const jobData = { data: 'testData' };
        const jobName = 'testJob';
        const jobIdentifier = 'testIdentifier';
        const jobScore = Date.now();
        const priority = 5;
        const delay = 1000;

        const response = await request(app)
            .post('/api/now')
            .send({ jobData, jobName, jobIdentifier, jobScore, priority, delay });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Job enqueued successfully' });
        expect(queueMock.now).toHaveBeenCalledWith(jobData, jobName, jobIdentifier, jobScore, priority, delay);
    });

    test('POST /api/start-loop should start the loop with rate limiting and concurrency control', async () => {
        const response = await request(app)
            .post('/api/start-loop');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Loop started successfully' });
        expect(queueMock.startLoop).toHaveBeenCalled();
    });

    test('POST /api/fail should fail a job with retries and backoff', async () => {
        const jobData = { data: 'testData' };
        const reason = 'testReason';
        const force = false;

        const response = await request(app)
            .post('/api/fail')
            .send({ jobData, reason, force });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Job failed successfully' });
        expect(queueMock.fail).toHaveBeenCalledWith(jobData, reason, force);
    });

    test('POST /api/emit-event should emit a job event', async () => {
        const event = 'jobFinished';
        const data = { data: 'testData' };

        const response = await request(app)
            .post('/api/emit-event')
            .send({ event, data });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Event emitted successfully' });
        expect(queueMock.emitEvent).toHaveBeenCalledWith(event, data);
    });

    test('POST /api/on should register a job event listener', async () => {
        const event = 'jobFinished';
        const hook = jest.fn();

        const response = await request(app)
            .post('/api/on')
            .send({ event, hook });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Event listener registered successfully' });
        expect(queueMock.on).toHaveBeenCalledWith(event, hook);
    });

    test('POST /api/run should track job progress and call completion callback', async () => {
        const jobName = 'testJob';
        const jobIdentifier = 'testIdentifier';
        const jobData = { data: 'testData', createdAt: new Date(), name: jobName, identifier: jobIdentifier, pickedAt: new Date() };

        const response = await request(app)
            .post('/api/run')
            .send({ jobName, jobIdentifier, jobData });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Job run successfully' });
        expect(queueMock.run).toHaveBeenCalledWith(jobName, jobIdentifier, jobData);
    });

    test('POST /api/rate-limit should update rate limit', async () => {
        const rateLimit = 10;

        const response = await request(app)
            .post('/api/rate-limit')
            .send({ rateLimit });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Rate limit updated successfully' });
        expect(queueMock.rateLimit).toBe(rateLimit);
    });

    test('POST /api/concurrency should update concurrency', async () => {
        const concurrency = 5;

        const response = await request(app)
            .post('/api/concurrency')
            .send({ concurrency });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Concurrency updated successfully' });
        expect(queueMock.maxWorkers).toBe(concurrency);
    });

    test('POST /api/retry-strategy should update retry strategy', async () => {
        const retryStrategy = { retries: 3, backoff: { type: 'exponential', delay: 1000 } };

        const response = await request(app)
            .post('/api/retry-strategy')
            .send({ retryStrategy });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Retry strategy updated successfully' });
        expect(queueMock.retries).toBe(retryStrategy.retries);
        expect(queueMock.backoff).toEqual(retryStrategy.backoff);
    });

    test('POST /api/backoff-strategy should update backoff strategy', async () => {
        const backoffStrategy = { type: 'exponential', delay: 1000 };

        const response = await request(app)
            .post('/api/backoff-strategy')
            .send({ backoffStrategy });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Backoff strategy updated successfully' });
        expect(queueMock.backoff).toEqual(backoffStrategy);
    });

    test('POST /api/job-progress should update job progress', async () => {
        const jobProgress = 50;

        const response = await request(app)
            .post('/api/job-progress')
            .send({ jobProgress });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Job progress updated successfully' });
        expect(queueMock.jobProgress).toBe(jobProgress);
    });

    test('POST /api/completion-callback should update completion callback', async () => {
        const completionCallback = jest.fn();

        const response = await request(app)
            .post('/api/completion-callback')
            .send({ completionCallback });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Completion callback updated successfully' });
        expect(queueMock.completionCallback).toBe(completionCallback);
    });

    test('POST /api/schema-validation should update schema validation', async () => {
        const schemaValidation = { type: 'object', properties: { data: { type: 'string' } }, required: ['data'] };

        const response = await request(app)
            .post('/api/schema-validation')
            .send({ schemaValidation });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Schema validation updated successfully' });
        expect(queueMock.jobSchemas['testJob']).toEqual(schemaValidation);
    });

    test('POST /api/job-dependencies should update job dependencies', async () => {
        const jobDependencies = ['dependentJob'];

        const response = await request(app)
            .post('/api/job-dependencies')
            .send({ jobDependencies });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Job dependencies updated successfully' });
        expect(queueMock.jobDependencies['testJob']).toEqual(jobDependencies);
    });

    test('POST /api/flow-control should update flow control', async () => {
        const flowControl = { type: 'sequential' };

        const response = await request(app)
            .post('/api/flow-control')
            .send({ flowControl });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Flow control updated successfully' });
        expect(queueMock.flowControl).toEqual(flowControl);
    });

    test('POST /api/metrics should update metrics', async () => {
        const metrics = { jobsProcessed: 100, jobsFailed: 5, jobsSucceeded: 95, jobDuration: [1000, 2000, 3000] };

        const response = await request(app)
            .post('/api/metrics')
            .send({ metrics });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Metrics updated successfully' });
        expect(queueMock.metrics).toEqual(metrics);
    });

    test('POST /api/job-events should update job events', async () => {
        const jobEvents = ['jobFinished'];

        const response = await request(app)
            .post('/api/job-events')
            .send({ jobEvents });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Job events updated successfully' });
        expect(queueMock.jobEvents).toEqual(jobEvents);
    });

    test('POST /api/listeners should update listeners', async () => {
        const listeners = { jobFinished: jest.fn() };

        const response = await request(app)
            .post('/api/listeners')
            .send({ listeners });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Listeners updated successfully' });
        expect(queueMock.listeners).toEqual(listeners);
    });

    test('GET /api/job-details should log errors', async () => {
        const error = new Error('Failed to fetch job details');
        queueMock.getCurrentQueue.mockRejectedValue(error);

        const response = await request(app).get('/api/job-details');

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'Failed to fetch job details' });
        expect(logger.error).toHaveBeenCalledWith('Error fetching job details:', error);
    });

    test('POST /api/requeue-job should log errors', async () => {
        const jobId = 'testJobId';
        const error = new Error('Failed to requeue job');
        queueMock.requeueJob.mockRejectedValue(error);

        const response = await request(app)
            .post('/api/requeue-job')
            .send({ jobId });

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'Failed to requeue job' });
        expect(logger.error).toHaveBeenCalledWith('Error requeuing job:', error);
    });

    test('gRPC GetJobDetails should log errors', (done) => {
        const error = new Error('Failed to fetch job details');
        queueMock.getCurrentQueue.mockRejectedValue(error);

        grpcClient.GetJobDetails({}, (err, response) => {
            expect(err).not.toBeNull();
            expect(err.message).toBe('Failed to fetch job details');
            expect(logger.error).toHaveBeenCalledWith('Error fetching job details:', error);
            done();
        });
    });

    test('gRPC RequeueJob should log errors', (done) => {
        const jobId = 'testJobId';
        const error = new Error('Failed to requeue job');
        queueMock.requeueJob.mockRejectedValue(error);

        grpcClient.RequeueJob({ jobId }, (err, response) => {
            expect(err).not.toBeNull();
            expect(err.message).toBe('Failed to requeue job');
            expect(logger.error).toHaveBeenCalledWith('Error requeuing job:', error);
            done();
        });
    });
});
