const { PopQueue } = require('../pop-queue/jobManagement');
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
});