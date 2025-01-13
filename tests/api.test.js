const request = require('supertest');
const express = require('express');
const { PopQueue } = require('./queue');
const api = require('./api');

jest.mock('./queue');

describe('API Endpoints', () => {
    let app;
    let queueMock;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api', api);

        queueMock = new PopQueue();
        PopQueue.mockImplementation(() => queueMock);
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
});
