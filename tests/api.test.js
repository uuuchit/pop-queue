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
});
