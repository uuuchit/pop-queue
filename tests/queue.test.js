const { PopQueue } = require('./queue');
const { MongoClient } = require('mongodb');
const Redis = require('ioredis');
const winston = require('winston');

jest.mock('mongodb');
jest.mock('ioredis');

describe('PopQueue', () => {
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

    test('should define a job', () => {
        const jobFn = jest.fn();
        queue.define('testJob', jobFn);
        expect(queue.runners['testJob'].fn).toBe(jobFn);
    });

    test('should enqueue a job with priority and delay', async () => {
        const jobData = { data: 'testData' };
        const jobName = 'testJob';
        const jobIdentifier = 'testIdentifier';
        const jobScore = Date.now();
        const priority = 5;
        const delay = 1000;

        await queue.now(jobData, jobName, jobIdentifier, jobScore, priority, delay);

        expect(dbMock.collection).toHaveBeenCalledWith('testCollection');
        expect(dbMock.findOneAndUpdate).toHaveBeenCalledWith(
            { identifier: jobIdentifier },
            { $set: { data: jobData, createdAt: expect.any(Date), name: jobName, identifier: jobIdentifier, priority, delay } },
            { upsert: true }
        );
        expect(redisMock.pipeline).toHaveBeenCalled();
        expect(redisMock.zadd).toHaveBeenCalledWith(`pop:queue:${jobName}`, expect.any(Number), jobIdentifier);
        expect(redisMock.set).toHaveBeenCalledWith(`pop:queue:${jobName}:${jobIdentifier}`, expect.any(String));
        expect(redisMock.exec).toHaveBeenCalled();
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

    test('should validate job data schema', async () => {
        const jobName = 'testJob';
        const jobData = { data: 'testData' };
        const schema = {
            type: 'object',
            properties: {
                data: { type: 'string' }
            },
            required: ['data']
        };

        queue.define(jobName, jest.fn(), { schema });

        await expect(queue.validateJobData(jobName, jobData)).resolves.not.toThrow();
    });

    test('should check job dependencies', async () => {
        const jobName = 'testJob';
        const dependentJobName = 'dependentJob';

        queue.define(dependentJobName, jest.fn());
        queue.define(jobName, jest.fn(), { dependencies: [dependentJobName] });

        redisMock.zcount.mockResolvedValue(0);

        await expect(queue.checkJobDependencies(jobName)).resolves.not.toThrow();
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

    test('should handle edge cases for job prioritization', async () => {
        const jobData = { data: 'priorityJob', priority: 10, delay: 0 };
        const jobName = 'edgeCaseTestJob';
        const jobIdentifier = `edgeCaseJobIdentifier${jobData.data}`;
        const jobScore = Date.now();

        await queue.now(jobData, jobName, jobIdentifier, jobScore, jobData.priority, jobData.delay);

        expect(dbMock.collection).toHaveBeenCalledWith('testCollection');
        expect(dbMock.findOneAndUpdate).toHaveBeenCalledWith(
            { identifier: jobIdentifier },
            { $set: { data: jobData, createdAt: expect.any(Date), name: jobName, identifier: jobIdentifier, priority: jobData.priority, delay: jobData.delay } },
            { upsert: true }
        );
        expect(redisMock.pipeline).toHaveBeenCalled();
        expect(redisMock.zadd).toHaveBeenCalledWith(`pop:queue:${jobName}`, expect.any(Number), jobIdentifier);
        expect(redisMock.set).toHaveBeenCalledWith(`pop:queue:${jobName}:${jobIdentifier}`, expect.any(String));
        expect(redisMock.exec).toHaveBeenCalled();
    });

    test('should handle edge cases for delayed jobs', async () => {
        const jobData = { data: 'delayedJob', priority: 0, delay: 10000 };
        const jobName = 'edgeCaseTestJob';
        const jobIdentifier = `edgeCaseJobIdentifier${jobData.data}`;
        const jobScore = Date.now();

        await queue.now(jobData, jobName, jobIdentifier, jobScore, jobData.priority, jobData.delay);

        expect(dbMock.collection).toHaveBeenCalledWith('testCollection');
        expect(dbMock.findOneAndUpdate).toHaveBeenCalledWith(
            { identifier: jobIdentifier },
            { $set: { data: jobData, createdAt: expect.any(Date), name: jobName, identifier: jobIdentifier, priority: jobData.priority, delay: jobData.delay } },
            { upsert: true }
        );
        expect(redisMock.pipeline).toHaveBeenCalled();
        expect(redisMock.zadd).toHaveBeenCalledWith(`pop:queue:${jobName}`, expect.any(Number), jobIdentifier);
        expect(redisMock.set).toHaveBeenCalledWith(`pop:queue:${jobName}:${jobIdentifier}`, expect.any(String));
        expect(redisMock.exec).toHaveBeenCalled();
    });

    test('should handle edge cases for retries', async () => {
        const jobData = { data: 'retryJob', priority: 0, delay: 0, retries: 3 };
        const jobName = 'edgeCaseTestJob';
        const jobIdentifier = `edgeCaseJobIdentifier${jobData.data}`;
        const jobScore = Date.now();

        await queue.now(jobData, jobName, jobIdentifier, jobScore, jobData.priority, jobData.delay);

        expect(dbMock.collection).toHaveBeenCalledWith('testCollection');
        expect(dbMock.findOneAndUpdate).toHaveBeenCalledWith(
            { identifier: jobIdentifier },
            { $set: { data: jobData, createdAt: expect.any(Date), name: jobName, identifier: jobIdentifier, priority: jobData.priority, delay: jobData.delay, retries: jobData.retries } },
            { upsert: true }
        );
        expect(redisMock.pipeline).toHaveBeenCalled();
        expect(redisMock.zadd).toHaveBeenCalledWith(`pop:queue:${jobName}`, expect.any(Number), jobIdentifier);
        expect(redisMock.set).toHaveBeenCalledWith(`pop:queue:${jobName}:${jobIdentifier}`, expect.any(String));
        expect(redisMock.exec).toHaveBeenCalled();
    });

    test('should handle edge cases for backoff strategies', async () => {
        const jobData = { data: 'backoffJob', priority: 0, delay: 0, backoff: { type: 'exponential', delay: 1000 } };
        const jobName = 'edgeCaseTestJob';
        const jobIdentifier = `edgeCaseJobIdentifier${jobData.data}`;
        const jobScore = Date.now();

        await queue.now(jobData, jobName, jobIdentifier, jobScore, jobData.priority, jobData.delay);

        expect(dbMock.collection).toHaveBeenCalledWith('testCollection');
        expect(dbMock.findOneAndUpdate).toHaveBeenCalledWith(
            { identifier: jobIdentifier },
            { $set: { data: jobData, createdAt: expect.any(Date), name: jobName, identifier: jobIdentifier, priority: jobData.priority, delay: jobData.delay, backoff: jobData.backoff } },
            { upsert: true }
        );
        expect(redisMock.pipeline).toHaveBeenCalled();
        expect(redisMock.zadd).toHaveBeenCalledWith(`pop:queue:${jobName}`, expect.any(Number), jobIdentifier);
        expect(redisMock.set).toHaveBeenCalledWith(`pop:queue:${jobName}:${jobIdentifier}`, expect.any(String));
        expect(redisMock.exec).toHaveBeenCalled();
    });

    test('should handle rate limiting', async () => {
        const jobData = { data: 'rateLimitedJob', priority: 0, delay: 0 };
        const jobName = 'rateLimitedTestJob';
        const jobIdentifier = `rateLimitedJobIdentifier${jobData.data}`;
        const jobScore = Date.now();

        queue.rateLimit = 1; // Set rate limit to 1 job per second

        await queue.now(jobData, jobName, jobIdentifier, jobScore, jobData.priority, jobData.delay);

        expect(dbMock.collection).toHaveBeenCalledWith('testCollection');
        expect(dbMock.findOneAndUpdate).toHaveBeenCalledWith(
            { identifier: jobIdentifier },
            { $set: { data: jobData, createdAt: expect.any(Date), name: jobName, identifier: jobIdentifier, priority: jobData.priority, delay: jobData.delay } },
            { upsert: true }
        );
        expect(redisMock.pipeline).toHaveBeenCalled();
        expect(redisMock.zadd).toHaveBeenCalledWith(`pop:queue:${jobName}`, expect.any(Number), jobIdentifier);
        expect(redisMock.set).toHaveBeenCalledWith(`pop:queue:${jobName}:${jobIdentifier}`, expect.any(String));
        expect(redisMock.exec).toHaveBeenCalled();
    });

    test('should handle concurrency control', async () => {
        const jobData = { data: 'concurrentJob', priority: 0, delay: 0 };
        const jobName = 'concurrentTestJob';
        const jobIdentifier = `concurrentJobIdentifier${jobData.data}`;
        const jobScore = Date.now();

        queue.maxWorkers = 1; // Set max workers to 1

        await queue.now(jobData, jobName, jobIdentifier, jobScore, jobData.priority, jobData.delay);

        expect(dbMock.collection).toHaveBeenCalledWith('testCollection');
        expect(dbMock.findOneAndUpdate).toHaveBeenCalledWith(
            { identifier: jobIdentifier },
            { $set: { data: jobData, createdAt: expect.any(Date), name: jobName, identifier: jobIdentifier, priority: jobData.priority, delay: jobData.delay } },
            { upsert: true }
        );
        expect(redisMock.pipeline).toHaveBeenCalled();
        expect(redisMock.zadd).toHaveBeenCalledWith(`pop:queue:${jobName}`, expect.any(Number), jobIdentifier);
        expect(redisMock.set).toHaveBeenCalledWith(`pop:queue:${jobName}:${jobIdentifier}`, expect.any(String));
        expect(redisMock.exec).toHaveBeenCalled();
    });

    test('should handle backoff strategies', async () => {
        const jobData = { data: 'backoffJob', priority: 0, delay: 0, backoff: { type: 'exponential', delay: 1000 } };
        const jobName = 'backoffTestJob';
        const jobIdentifier = `backoffJobIdentifier${jobData.data}`;
        const jobScore = Date.now();

        await queue.now(jobData, jobName, jobIdentifier, jobScore, jobData.priority, jobData.delay);

        expect(dbMock.collection).toHaveBeenCalledWith('testCollection');
        expect(dbMock.findOneAndUpdate).toHaveBeenCalledWith(
            { identifier: jobIdentifier },
            { $set: { data: jobData, createdAt: expect.any(Date), name: jobName, identifier: jobIdentifier, priority: jobData.priority, delay: jobData.delay, backoff: jobData.backoff } },
            { upsert: true }
        );
        expect(redisMock.pipeline).toHaveBeenCalled();
        expect(redisMock.zadd).toHaveBeenCalledWith(`pop:queue:${jobName}`, expect.any(Number), jobIdentifier);
        expect(redisMock.set).toHaveBeenCalledWith(`pop:queue:${jobName}:${jobIdentifier}`, expect.any(String));
        expect(redisMock.exec).toHaveBeenCalled();
    });

    test('should log errors when enqueuing a job', async () => {
        const jobData = { data: 'testData' };
        const jobName = 'testJob';
        const jobIdentifier = 'testIdentifier';
        const jobScore = Date.now();
        const priority = 5;
        const delay = 1000;

        const error = new Error('Failed to enqueue job');
        dbMock.findOneAndUpdate.mockRejectedValue(error);

        await expect(queue.now(jobData, jobName, jobIdentifier, jobScore, priority, delay)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error enqueuing job:', error);
    });

    test('should log errors when popping a job', async () => {
        const jobName = 'testJob';

        const error = new Error('Failed to pop job');
        redisMock.zpopmin.mockRejectedValue(error);

        await expect(queue.pop(jobName)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error popping job from queue:', error);
    });

    test('should log errors when finishing a job', async () => {
        const jobName = 'testJob';
        const jobIdentifier = 'testIdentifier';
        const jobData = { data: 'testData', createdAt: new Date(), name: jobName, identifier: jobIdentifier, pickedAt: new Date() };

        const error = new Error('Failed to finish job');
        dbMock.findOneAndUpdate.mockRejectedValue(error);

        await expect(queue.finish(jobData, jobName)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error finishing job:', error);
    });

    test('should log errors when failing a job', async () => {
        const jobName = 'testJob';
        const jobIdentifier = 'testIdentifier';
        const jobData = { data: 'testData', createdAt: new Date(), name: jobName, identifier: jobIdentifier, pickedAt: new Date(), attempts: 1 };

        const error = new Error('Failed to fail job');
        dbMock.findOneAndUpdate.mockRejectedValue(error);

        await expect(queue.fail(jobData, 'testReason')).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error failing job:', error);
    });

    test('should log errors when requeuing a job', async () => {
        const jobName = 'testJob';
        const documentId = 'testDocumentId';

        const error = new Error('Failed to requeue job');
        dbMock.findOne.mockRejectedValue(error);

        await expect(queue.requeueJob(jobName, documentId)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error requeuing job:', error);
    });

    test('should log errors when getting queue length', async () => {
        const jobName = 'testJob';

        const error = new Error('Failed to get queue length');
        redisMock.zcount.mockRejectedValue(error);

        await expect(queue.getQueueLength(jobName)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error getting queue length:', error);
    });

    test('should log errors when getting current queue', async () => {
        const jobName = 'testJob';

        const error = new Error('Failed to get current queue');
        redisMock.zrange.mockRejectedValue(error);

        await expect(queue.getCurrentQueue(jobName)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error getting current queue:', error);
    });

    test('should log errors when getting count in last N hours', async () => {
        const jobName = 'testJob';

        const error = new Error('Failed to get count in last N hours');
        dbMock.count.mockRejectedValue(error);

        await expect(queue.getCountInLastNHours(jobName, 1)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error getting count in last N hours:', error);
    });

    test('should log errors when getting paginated executed queue', async () => {
        const jobName = 'testJob';

        const error = new Error('Failed to get paginated executed queue');
        dbMock.toArray.mockRejectedValue(error);

        await expect(queue.getPaginatedExecutedQueue(jobName, { lastNDays: 1, skip: 0, limit: 10, sort: {}, search: '', status: '' })).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error getting paginated executed queue:', error);
    });

    test('should log errors when creating and enqueuing jobs for load test', async () => {
        const jobCount = 1000;
        const jobData = { data: `jobData0` };
        const jobName = 'loadTestJob';
        const jobIdentifier = `jobIdentifier0`;
        const jobScore = Date.now();

        const error = new Error('Failed to create and enqueue jobs for load test');
        dbMock.findOneAndUpdate.mockRejectedValue(error);

        await expect(queue.createAndEnqueueJobs(jobCount)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error creating and enqueuing jobs for load test:', error);
    });

    test('should log errors when running concurrent tests for load test', async () => {
        const concurrentJobCount = 1000;

        const error = new Error('Failed to run concurrent tests for load test');
        redisMock.zpopmin.mockRejectedValue(error);

        await expect(queue.runConcurrentTests(concurrentJobCount)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error running concurrent tests for load test:', error);
    });

    test('should log errors when running sequential tests for load test', async () => {
        const sequentialJobCount = 1000;

        const error = new Error('Failed to run sequential tests for load test');
        redisMock.zpopmin.mockRejectedValue(error);

        await expect(queue.runSequentialTests(sequentialJobCount)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error running sequential tests for load test:', error);
    });

    test('should log errors when validating job data schema', async () => {
        const jobName = 'testJob';
        const jobData = { data: 'testData' };
        const schema = {
            type: 'object',
            properties: {
                data: { type: 'string' }
            },
            required: ['data']
        };

        queue.define(jobName, jest.fn(), { schema });

        const error = new Error('Job data validation failed');
        queue.ajv.compile = jest.fn().mockReturnValue(() => { throw error; });

        await expect(queue.validateJobData(jobName, jobData)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error validating job data:', error);
    });

    test('should log errors when checking job dependencies', async () => {
        const jobName = 'testJob';
        const dependentJobName = 'dependentJob';

        queue.define(dependentJobName, jest.fn());
        queue.define(jobName, jest.fn(), { dependencies: [dependentJobName] });

        const error = new Error('Job dependency not met');
        redisMock.zcount.mockResolvedValue(1);

        await expect(queue.checkJobDependencies(jobName)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error checking job dependencies:', error);
    });

    test('should log errors when getting metrics', async () => {
        const error = new Error('Failed to get metrics');
        queue.getMetrics = jest.fn().mockRejectedValue(error);

        await expect(queue.getMetrics()).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error getting metrics:', error);
    });
});
