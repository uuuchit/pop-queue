const { PopQueue } = require('../pop-queue/index');
const config = require('../config/config');
const { MongoClient } = require('mongodb');
const Redis = require('ioredis');
const winston = require('winston');
const cron = require('node-cron');

jest.mock('mongodb');
jest.mock('ioredis');

describe('Task Scheduling and Job Processing', () => {
    let queue;
    let dbMock;
    let redisMock;
    let logger;

    beforeAll(async () => {
        dbMock = {
            collection: jest.fn().mockReturnThis(),
            findOneAndUpdate: jest.fn(),
            findOne: jest.fn(),
            insertOne: jest.fn(),
            query: jest.fn()
        };

        redisMock = {
            pipeline: jest.fn().mockReturnThis(),
            zadd: jest.fn(),
            set: jest.fn(),
            zpopmin: jest.fn(),
            get: jest.fn(),
            del: jest.fn(),
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

    test('should schedule a daily data backup job at midnight', async () => {
        const jobName = 'dailyBackup';
        const cronExpression = '0 0 * * *'; // Every day at midnight
        const jobData = { data: 'backupData' };
        const jobIdentifier = 'backupJobIdentifier';

        queue.define(jobName, async (job) => {
            console.log(`Processing job: ${job.identifier}`);
            // Simulate job processing time
            await new Promise(resolve => setTimeout(resolve, 100));
            console.log(`Job processed: ${job.identifier}`);
            return true;
        });

        queue.schedule(jobName, cronExpression, async () => {
            await queue.now(jobData, jobName, jobIdentifier, Date.now());
        });

        // Simulate the cron job execution
        cron.schedule.mock.calls[0][1]();

        expect(dbMock.collection).toHaveBeenCalledWith('testCollection');
        expect(dbMock.findOneAndUpdate).toHaveBeenCalledWith(
            { identifier: jobIdentifier },
            { $set: { data: jobData, createdAt: expect.any(Date), name: jobName, identifier: jobIdentifier, priority: 0, delay: 0 } },
            { upsert: true }
        );
        expect(redisMock.pipeline).toHaveBeenCalled();
        expect(redisMock.zadd).toHaveBeenCalledWith(`pop:queue:${jobName}`, expect.any(Number), jobIdentifier);
        expect(redisMock.set).toHaveBeenCalledWith(`pop:queue:${jobName}:${jobIdentifier}`, expect.any(String));
        expect(redisMock.exec).toHaveBeenCalled();
    });

    test('should process image resizing jobs', async () => {
        const jobName = 'imageResizing';
        const jobData = { inputPath: 'input.jpg', outputPath: 'output.jpg', width: 800, height: 600 };
        const jobIdentifier = 'imageResizingJobIdentifier';

        queue.define(jobName, async (job) => {
            console.log(`Processing image resizing job: ${job.identifier}`);
            // Simulate image resizing processing time
            await new Promise(resolve => setTimeout(resolve, 100));
            console.log(`Image resizing job processed: ${job.identifier}`);
            return true;
        });

        await queue.now(jobData, jobName, jobIdentifier, Date.now());

        expect(dbMock.collection).toHaveBeenCalledWith('testCollection');
        expect(dbMock.findOneAndUpdate).toHaveBeenCalledWith(
            { identifier: jobIdentifier },
            { $set: { data: jobData, createdAt: expect.any(Date), name: jobName, identifier: jobIdentifier, priority: 0, delay: 0 } },
            { upsert: true }
        );
        expect(redisMock.pipeline).toHaveBeenCalled();
        expect(redisMock.zadd).toHaveBeenCalledWith(`pop:queue:${jobName}`, expect.any(Number), jobIdentifier);
        expect(redisMock.set).toHaveBeenCalledWith(`pop:queue:${jobName}:${jobIdentifier}`, expect.any(String));
        expect(redisMock.exec).toHaveBeenCalled();
    });

    test('should process video transcoding jobs', async () => {
        const jobName = 'videoTranscoding';
        const jobData = { inputPath: 'input.mp4', outputPath: 'output.mp4', format: 'mp4' };
        const jobIdentifier = 'videoTranscodingJobIdentifier';

        queue.define(jobName, async (job) => {
            console.log(`Processing video transcoding job: ${job.identifier}`);
            // Simulate video transcoding processing time
            await new Promise(resolve => setTimeout(resolve, 100));
            console.log(`Video transcoding job processed: ${job.identifier}`);
            return true;
        });

        await queue.now(jobData, jobName, jobIdentifier, Date.now());

        expect(dbMock.collection).toHaveBeenCalledWith('testCollection');
        expect(dbMock.findOneAndUpdate).toHaveBeenCalledWith(
            { identifier: jobIdentifier },
            { $set: { data: jobData, createdAt: expect.any(Date), name: jobName, identifier: jobIdentifier, priority: 0, delay: 0 } },
            { upsert: true }
        );
        expect(redisMock.pipeline).toHaveBeenCalled();
        expect(redisMock.zadd).toHaveBeenCalledWith(`pop:queue:${jobName}`, expect.any(Number), jobIdentifier);
        expect(redisMock.set).toHaveBeenCalledWith(`pop:queue:${jobName}:${jobIdentifier}`, expect.any(String));
        expect(redisMock.exec).toHaveBeenCalled();
    });

    test('should process bulk email jobs', async () => {
        const jobName = 'bulkEmail';
        const jobData = { to: 'user@example.com', subject: 'Hello', text: 'This is a bulk email.' };
        const jobIdentifier = 'bulkEmailJobIdentifier';

        queue.define(jobName, async (job) => {
            console.log(`Processing bulk email job: ${job.identifier}`);
            // Simulate email sending processing time
            await new Promise(resolve => setTimeout(resolve, 100));
            console.log(`Bulk email job processed: ${job.identifier}`);
            return true;
        });

        await queue.now(jobData, jobName, jobIdentifier, Date.now());

        expect(dbMock.collection).toHaveBeenCalledWith('testCollection');
        expect(dbMock.findOneAndUpdate).toHaveBeenCalledWith(
            { identifier: jobIdentifier },
            { $set: { data: jobData, createdAt: expect.any(Date), name: jobName, identifier: jobIdentifier, priority: 0, delay: 0 } },
            { upsert: true }
        );
        expect(redisMock.pipeline).toHaveBeenCalled();
        expect(redisMock.zadd).toHaveBeenCalledWith(`pop:queue:${jobName}`, expect.any(Number), jobIdentifier);
        expect(redisMock.set).toHaveBeenCalledWith(`pop:queue:${jobName}:${jobIdentifier}`, expect.any(String));
        expect(redisMock.exec).toHaveBeenCalled();
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
