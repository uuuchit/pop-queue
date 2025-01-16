
const { PopQueue } = require('../pop-queue/index');

const { MongoClient } = require('mongodb');
const Redis = require('ioredis');
const winston = require('winston');

jest.mock('mongodb');
jest.mock('ioredis');

describe('PopQueue - Queue Management', () => {
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

    test('should get queue length', async () => {
        const jobName = 'testJob';
        redisMock.zcount.mockResolvedValue(5);

        const length = await queue.getQueueLength(jobName);

        expect(redisMock.zcount).toHaveBeenCalledWith(`pop:queue:${jobName}`, '-inf', '+inf');
        expect(length).toBe(5);
    });

    test('should get current queue', async () => {
        const jobName = 'testJob';
        const jobData = { data: 'testData', createdAt: new Date(), name: jobName, identifier: 'testIdentifier' };

        redisMock.zrange.mockResolvedValue([JSON.stringify(jobData)]);

        const queueData = await queue.getCurrentQueue(jobName);

        expect(redisMock.zrange).toHaveBeenCalledWith(`pop:queue:${jobName}`, 0, -1);
        expect(queueData).toEqual([expect.objectContaining(jobData)]);
    });

    test('should get count in last N hours', async () => {
        const jobName = 'testJob';
        const count = 10;

        dbMock.count.mockResolvedValue(count);

        const result = await queue.getCountInLastNHours(jobName, 1);

        expect(dbMock.collection).toHaveBeenCalledWith('testCollection');
        expect(dbMock.count).toHaveBeenCalledWith(expect.any(Object));
        expect(result).toBe(count);
    });

    test('should get paginated executed queue', async () => {
        const jobName = 'testJob';
        const docs = [{ data: 'testData' }];

        dbMock.toArray.mockResolvedValue(docs);

        const result = await queue.getPaginatedExecutedQueue(jobName, { lastNDays: 1, skip: 0, limit: 10, sort: {}, search: '', status: '' });

        expect(dbMock.collection).toHaveBeenCalledWith('testCollection');
        expect(dbMock.find).toHaveBeenCalledWith(expect.any(Object));
        expect(dbMock.sort).toHaveBeenCalledWith({});
        expect(dbMock.skip).toHaveBeenCalledWith(0);
        expect(dbMock.limit).toHaveBeenCalledWith(10);
        expect(dbMock.toArray).toHaveBeenCalled();
        expect(result).toEqual(docs);
    });

    test('should get metrics', async () => {
        const metrics = {
            jobsProcessed: 100,
            jobsFailed: 5,
            jobsSucceeded: 95,
            jobDuration: [1000, 2000, 3000]
        };

        queue.metrics = metrics;

        const result = await queue.getMetrics();

        expect(result).toEqual(metrics);
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

    test('should handle job execution with retries and backoff', async () => {
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

    test('should handle job execution with custom completion callback', async () => {
        const jobName = 'testJob';
        const jobIdentifier = 'testIdentifier';
        const jobData = { data: 'testData', createdAt: new Date(), name: jobName, identifier: jobIdentifier, pickedAt: new Date() };

        const completionCallback = jest.fn();

        queue.define(jobName, async (job) => {
            job.progress = 50;
            await queue.emitEvent('jobProgress', job);
            return true;
        }, { completionCallback });

        redisMock.zpopmin.mockResolvedValue([jobIdentifier]);
        redisMock.get.mockResolvedValue(JSON.stringify(jobData));

        await queue.run(jobName);

        expect(completionCallback).toHaveBeenCalledWith(expect.objectContaining(jobData));
    });

    test('should emit and listen to job events', async () => {
        const eventHook = jest.fn();
        queue.on('jobFinished', eventHook);

        const jobData = { data: 'testData', createdAt: new Date(), name: 'testJob', identifier: 'testIdentifier', pickedAt: new Date() };
        await queue.emitEvent('jobFinished', jobData);

        expect(eventHook).toHaveBeenCalledWith(jobData);
    });

    test('should track job progress and call completion callback', async () => {
        const jobName = 'testJob';
        const jobIdentifier = 'testIdentifier';
        const jobData = { data: 'testData', createdAt: new Date(), name: jobName, identifier: jobIdentifier, pickedAt: new Date() };

        const jobFn = jest.fn(async (job) => {
            job.progress = 50;
            await queue.emitEvent('jobProgress', job);
            return true;
        });

        queue.define(jobName, jobFn);

        redisMock.zpopmin.mockResolvedValue([jobIdentifier]);
        redisMock.get.mockResolvedValue(JSON.stringify(jobData));

        await queue.run(jobName);

        expect(jobFn).toHaveBeenCalledWith(expect.objectContaining(jobData));
        expect(redisMock.zpopmin).toHaveBeenCalledWith(`pop:queue:${jobName}`, 1);
        expect(redisMock.get).toHaveBeenCalledWith(`pop:queue:${jobName}:${jobIdentifier}`);
        expect(dbMock.collection).toHaveBeenCalledWith('testCollection');
        expect(dbMock.findOneAndUpdate).toHaveBeenCalledWith(
            { identifier: jobIdentifier },
            { $inc: { attempts: 1 }, $set: { pickedAt: expect.any(Date) } }
        );
    });
});
