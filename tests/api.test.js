const request = require('supertest');
const express = require('express');
const { PopQueue } = require('./queue');
const api = require('./api');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

jest.mock('./queue');

describe('API Endpoints', () => {
    let app;
    let queueMock;
    let grpcClient;

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
});
