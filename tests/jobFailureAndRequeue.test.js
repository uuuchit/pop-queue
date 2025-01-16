
const { PopQueue } = require('../pop-queue/index');

const { MongoClient } = require('mongodb');
const Redis = require('ioredis');
const winston = require('winston');

jest.mock('mongodb');
jest.mock('ioredis');

describe('PopQueue - Job Failure and Requeue', () => {
    let queue;
    let dbMock;
    let redisMock;
    let logger;

    beforeEach(async () => {
        dbMock = {
            collection: jest.fn().mockReturnThis(),
            findOneAndUpdate: jest.fn(),
            findOne: jest.fn(),
            count: jest.fn(),
            find: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            toArray: jest.fn()
        };

        redisMock = {
            zadd: jest.fn(),
            set: jest.fn(),
            zpopmin: jest.fn(),
            get: jest.fn(),
            del: jest.fn(),
            zcount: jest.fn(),
            zrange: jest.fn(),
            pipeline: jest.fn().mockReturnThis(),
            exec: jest.fn()
        };

        MongoClient.mockImplementation(() => ({
            connect: jest.fn(),
            db: jest.fn(() => dbMock)
        }));

        Redis.mockImplementation(() => redisMock);

        queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'testDb', 'testCollection', 3);
        await queue.connect();

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

    test('should fail a job with retries and backoff', async () => {
        const jobName = 'testJob';
        const jobIdentifier = 'testIdentifier';
        const jobData = { data: 'testData', createdAt: new Date(), name: jobName, identifier: jobIdentifier, pickedAt: new Date(), attempts: 1 };

        dbMock.findOneAndUpdate.mockResolvedValue({ value: jobData });

        await queue.fail(jobData, 'testReason');

        expect(dbMock.collection).toHaveBeenCalledWith('testCollection');
        expect(dbMock.findOneAndUpdate).toHaveBeenCalledWith(
            { identifier: jobIdentifier },
            {
                $unset: { pickedAt: 1, finishedAt: 1, status: 1, duration: 1 },
                $push: {
                    failedReason: { reason: 'testReason', time: expect.any(Date) },
                    runHistory: expect.any(Object)
                },
                $set: { requeuedAt: expect.any(Date) }
            },
            { new: true }
        );
    });

    test('should requeue a job', async () => {
        const jobName = 'testJob';
        const documentId = 'testDocumentId';
        const jobData = { data: 'testData', createdAt: new Date(), name: jobName, identifier: 'testIdentifier' };

        dbMock.findOne.mockResolvedValue(jobData);

        await queue.requeueJob(jobName, documentId);

        expect(dbMock.collection).toHaveBeenCalledWith('testCollection');
        expect(dbMock.findOne).toHaveBeenCalledWith({ _id: documentId });
        expect(dbMock.findOneAndUpdate).toHaveBeenCalledWith(
            { identifier: jobData.identifier },
            {
                $unset: { pickedAt: 1, finishedAt: 1, status: 1, duration: 1 },
                $push: {
                    failedReason: { reason: 'Unknown, manually Requeued', time: expect.any(Date) },
                    runHistory: expect.any(Object)
                },
                $set: { requeuedAt: expect.any(Date) }
            },
            { new: true }
        );
    });

    test('should handle job failure with retries and backoff', async () => {
        const jobName = 'testJob';
        const jobIdentifier = 'testIdentifier';
        const jobData = { data: 'testData', createdAt: new Date(), name: jobName, identifier: jobIdentifier, pickedAt: new Date(), attempts: 2 };

        dbMock.findOneAndUpdate.mockResolvedValue({ value: jobData });

        await queue.fail(jobData, 'testReason');

        expect(dbMock.collection).toHaveBeenCalledWith('testCollection');
        expect(dbMock.findOneAndUpdate).toHaveBeenCalledWith(
            { identifier: jobIdentifier },
            {
                $unset: { pickedAt: 1, finishedAt: 1, status: 1, duration: 1 },
                $push: {
                    failedReason: { reason: 'testReason', time: expect.any(Date) },
                    runHistory: expect.any(Object)
                },
                $set: { requeuedAt: expect.any(Date) }
            },
            { new: true }
        );
    });

    test('should handle job requeueing with custom collection name', async () => {
        const jobName = 'testJob';
        const documentId = 'testDocumentId';
        const jobData = { data: 'testData', createdAt: new Date(), name: jobName, identifier: 'testIdentifier' };
        const customCollectionName = 'customCollection';

        dbMock.findOne.mockResolvedValue(jobData);

        await queue.requeueJob(jobName, documentId, customCollectionName);

        expect(dbMock.collection).toHaveBeenCalledWith(customCollectionName);
        expect(dbMock.findOne).toHaveBeenCalledWith({ _id: documentId });
        expect(dbMock.findOneAndUpdate).toHaveBeenCalledWith(
            { identifier: jobData.identifier },
            {
                $unset: { pickedAt: 1, finishedAt: 1, status: 1, duration: 1 },
                $push: {
                    failedReason: { reason: 'Unknown, manually Requeued', time: expect.any(Date) },
                    runHistory: expect.any(Object)
                },
                $set: { requeuedAt: expect.any(Date) }
            },
            { new: true }
        );
    });

    test('should handle job failure with custom completion callback', async () => {
        const jobName = 'testJob';
        const jobIdentifier = 'testIdentifier';
        const jobData = { data: 'testData', createdAt: new Date(), name: jobName, identifier: jobIdentifier, pickedAt: new Date(), attempts: 2 };
        const completionCallback = jest.fn();

        queue.define(jobName, async (job) => {
            job.progress = 50;
            await queue.emitEvent('jobProgress', job);
            return false;
        }, { completionCallback });

        dbMock.findOneAndUpdate.mockResolvedValue({ value: jobData });

        await queue.run(jobName);

        expect(completionCallback).toHaveBeenCalledWith(expect.objectContaining(jobData));
    });
});
