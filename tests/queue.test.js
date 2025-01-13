const { PopQueue } = require('./queue');
const { MongoClient } = require('mongodb');
const Redis = require('ioredis');

jest.mock('mongodb');
jest.mock('ioredis');

describe('PopQueue', () => {
    let queue;
    let dbMock;
    let redisMock;

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
            zrange: jest.fn()
        };

        MongoClient.mockImplementation(() => ({
            connect: jest.fn(),
            db: jest.fn(() => dbMock)
        }));

        Redis.mockImplementation(() => redisMock);

        queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'testDb', 'testCollection', 3);
        await queue.connect();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should define a job', () => {
        const jobFn = jest.fn();
        queue.define('testJob', jobFn);
        expect(queue.runners['testJob'].fn).toBe(jobFn);
    });

    test('should enqueue a job', async () => {
        const jobData = { data: 'testData' };
        const jobName = 'testJob';
        const jobIdentifier = 'testIdentifier';
        const jobScore = Date.now();

        await queue.now(jobData, jobName, jobIdentifier, jobScore);

        expect(dbMock.collection).toHaveBeenCalledWith('testCollection');
        expect(dbMock.findOneAndUpdate).toHaveBeenCalledWith(
            { identifier: jobIdentifier },
            { $set: { data: jobData, createdAt: expect.any(Date), name: jobName, identifier: jobIdentifier } },
            { upsert: true }
        );
        expect(redisMock.zadd).toHaveBeenCalledWith(`pop:queue:${jobName}`, jobScore, jobIdentifier);
        expect(redisMock.set).toHaveBeenCalledWith(`pop:queue:${jobName}:${jobIdentifier}`, expect.any(String));
    });

    test('should pop a job', async () => {
        const jobName = 'testJob';
        const jobIdentifier = 'testIdentifier';
        const jobData = { data: 'testData', createdAt: new Date(), name: jobName, identifier: jobIdentifier };

        redisMock.zpopmin.mockResolvedValue([jobIdentifier]);
        redisMock.get.mockResolvedValue(JSON.stringify(jobData));

        const job = await queue.pop(jobName);

        expect(redisMock.zpopmin).toHaveBeenCalledWith(`pop:queue:${jobName}`, 1);
        expect(redisMock.get).toHaveBeenCalledWith(`pop:queue:${jobName}:${jobIdentifier}`);
        expect(dbMock.collection).toHaveBeenCalledWith('testCollection');
        expect(dbMock.findOneAndUpdate).toHaveBeenCalledWith(
            { identifier: jobIdentifier },
            { $inc: { attempts: 1 }, $set: { pickedAt: expect.any(Date) } }
        );
        expect(job).toEqual(expect.objectContaining(jobData));
    });

    test('should finish a job', async () => {
        const jobName = 'testJob';
        const jobIdentifier = 'testIdentifier';
        const jobData = { data: 'testData', createdAt: new Date(), name: jobName, identifier: jobIdentifier, pickedAt: new Date() };

        await queue.finish(jobData, jobName);

        expect(dbMock.collection).toHaveBeenCalledWith('testCollection');
        expect(dbMock.findOneAndUpdate).toHaveBeenCalledWith(
            { identifier: jobIdentifier },
            {
                $set: {
                    finishedAt: expect.any(Date),
                    duration: expect.any(Number),
                    delay: expect.any(Number),
                    status: 'done'
                }
            }
        );
        expect(redisMock.del).toHaveBeenCalledWith(`pop:queue:${jobName}:${jobIdentifier}`);
    });

    test('should fail a job', async () => {
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

    test('should create and enqueue jobs for load test', async () => {
        const jobCount = 1000;
        const jobData = { data: `jobData0` };
        const jobName = 'loadTestJob';
        const jobIdentifier = `jobIdentifier0`;
        const jobScore = Date.now();

        await queue.createAndEnqueueJobs(jobCount);

        expect(dbMock.collection).toHaveBeenCalledWith('testCollection');
        expect(dbMock.findOneAndUpdate).toHaveBeenCalledWith(
            { identifier: jobIdentifier },
            { $set: { data: jobData, createdAt: expect.any(Date), name: jobName, identifier: jobIdentifier } },
            { upsert: true }
        );
        expect(redisMock.zadd).toHaveBeenCalledWith(`pop:queue:${jobName}`, jobScore, jobIdentifier);
        expect(redisMock.set).toHaveBeenCalledWith(`pop:queue:${jobName}:${jobIdentifier}`, expect.any(String));
    });

    test('should run concurrent tests for load test', async () => {
        const concurrentJobCount = 1000;

        redisMock.zpopmin.mockResolvedValue(['jobIdentifier0']);
        redisMock.get.mockResolvedValue(JSON.stringify({ data: 'jobData0', createdAt: new Date(), name: 'loadTestJob', identifier: 'jobIdentifier0' }));

        await queue.runConcurrentTests(concurrentJobCount);

        expect(redisMock.zpopmin).toHaveBeenCalledWith('pop:queue:loadTestJob', 1);
        expect(redisMock.get).toHaveBeenCalledWith('pop:queue:loadTestJob:jobIdentifier0');
    });

    test('should run sequential tests for load test', async () => {
        const sequentialJobCount = 1000;

        redisMock.zpopmin.mockResolvedValue(['jobIdentifier0']);
        redisMock.get.mockResolvedValue(JSON.stringify({ data: 'jobData0', createdAt: new Date(), name: 'loadTestJob', identifier: 'jobIdentifier0' }));

        await queue.runSequentialTests(sequentialJobCount);

        expect(redisMock.zpopmin).toHaveBeenCalledWith('pop:queue:loadTestJob', 1);
        expect(redisMock.get).toHaveBeenCalledWith('pop:queue:loadTestJob:jobIdentifier0');
    });
});
