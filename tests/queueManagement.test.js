const { PopQueue } = require('../pop-queue/jobManagement');
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
});