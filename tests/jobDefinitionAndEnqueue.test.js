
const { PopQueue } = require('../pop-queue/index');

const { MongoClient } = require('mongodb');
const Redis = require('ioredis');
const winston = require('winston');

jest.mock('mongodb');
jest.mock('ioredis');

describe('PopQueue - Job Definition and Enqueue', () => {
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

    test('should handle job definition with schema validation', () => {
        const jobFn = jest.fn();
        const jobSchema = {
            type: 'object',
            properties: {
                data: { type: 'string' }
            },
            required: ['data']
        };
        queue.define('testJobWithSchema', jobFn, { schema: jobSchema });
        expect(queue.runners['testJobWithSchema'].fn).toBe(jobFn);
        expect(queue.jobSchemas['testJobWithSchema']).toBe(jobSchema);
        const validData = { data: 'test' };  
       expect(() => queue.validateJobData('testJobWithSchema', validData)).not.toThrow();  
       
       // Test invalid data  
       const invalidData = { data: 123 };  
       expect(() => queue.validateJobData('testJobWithSchema', invalidData)).toThrow();  
         
    });

    test('should handle job definition with dependencies', async () => {
        const jobFn = jest.fn();
        const jobDependencies = ['dependentJob'];
        queue.define('testJobWithDependencies', jobFn, { dependencies: jobDependencies });
        expect(queue.runners['testJobWithDependencies'].fn).toBe(jobFn);
        expect(queue.jobDependencies['testJobWithDependencies']).toBe(jobDependencies);
        const dependentJobFn = jest.fn();  
    queue.define('dependentJob', dependentJobFn);  
    
    // Test execution order  
   await queue.run('testJobWithDependencies');  
   expect(dependentJobFn).toHaveBeenCalledBefore(jobFn);
    });

    test('should handle job definition with middleware', async () => {
        const jobFn = jest.fn();
        const middleware = jest.fn();
        queue.define('testJobWithMiddleware', jobFn, { middleware });
        expect(queue.runners['testJobWithMiddleware'].fn).toBe(jobFn);
        expect(queue.runners['testJobWithMiddleware'].middleware).toBe(middleware);
        // Test middleware execution  
        const jobData = { data: 'test' };  
        await queue.run('testJobWithMiddleware', jobData);  
        expect(middleware).toHaveBeenCalledWith(jobData);  
        expect(middleware).toHaveBeenCalledBefore(jobFn);
    });

    test('should handle job definition with custom collection name', () => {
        const jobFn = jest.fn();
        const customCollectionName = 'customCollection';
        queue.define('testJobWithCustomCollection', jobFn, { cName: customCollectionName });
        expect(queue.runners['testJobWithCustomCollection'].fn).toBe(jobFn);
        expect(queue.runners['testJobWithCustomCollection'].cName).toBe(customCollectionName);
    });

    test('should handle job definition with completion callback', () => {
        const jobFn = jest.fn();
        const completionCallback = jest.fn();
        queue.define('testJobWithCompletionCallback', jobFn, { completionCallback });
        expect(queue.runners['testJobWithCompletionCallback'].fn).toBe(jobFn);
        expect(queue.runners['testJobWithCompletionCallback'].options.completionCallback).toBe(completionCallback);
    });
});
