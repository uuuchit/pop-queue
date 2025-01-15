const { connectDb } = require('./db');
const { connectRedis } = require('./redis');
const { pushToQueue, pushToBatchQueue, popBatch, pop, finish, fail, moveToDeadLetterQueue } = require('./jobExecution');
const { notifySystems } = require('./notifications');
const config = require('../config/config');
const EventEmitter = require('events');
const winston = require('winston');
const Ajv = require('ajv');
const cron = require('node-cron');
const Redis = require('ioredis');
const Redlock = require('redlock');

class PopQueue extends EventEmitter {
    constructor(dbUrl, redis, dbName, cName, retries, mongoShardConfig = null, redisClusterConfig = null, workerId = null, memcachedUrl = null, postgresUrl = null) {
        super();
        this.dbUrl = dbUrl || config.dbUrl;
        this.redis = redis || config.redisUrl;
        this.cName = cName || config.collectionName;
        this.dbName = dbName || config.dbName;
        this.retries = retries || config.retries;
        this.runners = {};
        this.loopRunning = false;
        this.mongoShardConfig = mongoShardConfig;
        this.redisClusterConfig = redisClusterConfig;
        this.workerPool = [];
        this.maxWorkers = 5; // Default max workers
        this.rateLimit = 100; // Default rate limit
        this.resourceAware = false; // Default resource-aware execution
        this.plugins = [];
        this.eventHooks = {};
        this.notificationConfig = config.notificationConfig || {};
        this.workerId = workerId || `worker-${Math.random().toString(36).substr(2, 9)}`;
        this.workerTimeout = config.workerTimeout || 30000;
        this.memcachedUrl = memcachedUrl || config.memcachedUrl;
        this.postgresUrl = postgresUrl || config.postgresUrl;
        this.ajv = new Ajv();
        this.jobSchemas = {};
        this.jobDependencies = {};
        this.metrics = {
            jobsProcessed: 0,
            jobsFailed: 0,
            jobsSucceeded: 0,
            jobDuration: []
        };

        // Configure logging
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.json(),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ filename: 'error.log', level: 'error' }),
                new winston.transports.File({ filename: 'combined.log' })
            ]
        });

        // Configuration options for batch size, parallel execution, and Redis pipelining
        this.batchSize = config.batchSize || 1000;
        this.parallelExecution = config.parallelExecution || true;
        this.redisPipelining = config.redisPipelining || true;
        this.popBatch = popBatch.bind(this);
        this.pushToQueue = pushToQueue.bind(this);
        this.finish = finish.bind(this);
        this.fail = fail.bind(this);
        this.moveToDeadLetterQueue = moveToDeadLetterQueue.bind(this);
        this.pop = pop.bind(this);
    }

    async define(name, fn, options = {}) {
        this.runners[name] = {
            fn,
            options,
            cName: options.cName || "pop_queues"
        };
        if (options.middleware) {
            this.runners[name].middleware = options.middleware;
        }
        if (options.schema) {
            this.jobSchemas[name] = options.schema;
        }
        if (options.dependencies) {
            this.jobDependencies[name] = options.dependencies;
        }
    }

    async start(runLoop) {
        await this.registerWorker();
        await this.startLoop();
        setInterval(async () => {
            if (!this.loopRunning) {
                await this.startLoop();
            }
        }, 1000)
        this.startHeartbeat();
    }

    getDbCollectionName(name) {
        if (this.runner && this.runners[name] && this.runners[name].cName) {
            return this.runners[name].cName
        } else {
            return this.cName;
        }
    }

    async startLoop() {
        let names = Object.keys(this.runners);
        if (names.length) {
            this.loopRunning = true;
            while (true) {
                let counter = 0;
                for (let name of names) {
                    try {
                        await this.run(name);
                    } catch (e) {
                        if (e.code == 404) {
                            counter++;
                        }
                    }
                }
                if (counter == names.length) {
                    this.loopRunning = false
                    break;                    
                }
            }
        }
    }

    async connect() {
        await Promise.all([connectDb(this.dbUrl, this.dbName, this.mongoShardConfig), connectRedis(this.redis, this.redisClusterConfig)]);
    }

    async now(job, name, identifier, score, priority = 0, delay = 0) {
        try {
            let document = {data: job, createdAt: new Date(), name, identifier, priority, delay};
            if (!this.db || !this.redisClient) {
                await this.connect();
                console.log("Connected Db");
            }
            if (this.dbUrl.startsWith('postgres://')) {
                const insertQuery = `
                    INSERT INTO ${this.cName} (data, createdAt, name, identifier, priority, delay)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (identifier) DO UPDATE SET
                    data = EXCLUDED.data,
                    createdAt = EXCLUDED.createdAt,
                    name = EXCLUDED.name,
                    priority = EXCLUDED.priority,
                    delay = EXCLUDED.delay;
                `;
                await this.db.query(insertQuery, [document.data, document.createdAt, document.name, document.identifier, document.priority, document.delay]);
            } else {
                await this.db.collection(this.getDbCollectionName(name)).findOneAndUpdate({identifier}, {$set: document}, {upsert: true});
            }
            await this.pushToQueue(document, name, identifier, score, priority, delay);
        } catch(e) {
            console.log(e);
            this.logger.error('Error enqueuing job:', e);
        }
    }

    async run(name) {
        let jobs = await this.popBatch(name, this.batchSize);
        if (!jobs.length) {
            let error = new Error(`No job for ${name}`);
            error.code = 404;
            throw error;
        }
        try {
            if (this.runners[name] && this.runners[name].fn) {
                const promises = jobs.map(async (job) => {
                    try {
                        let fnTimeout = setTimeout(() => {
                            throw new Error("Timeout");
                        }, (this.runners[name].options && this.runners[name].options.timeout) || 10 * 60 * 1000)
                        const isSuccess = await this.runners[name].fn(job);
                        this.progress(job, 50); // Update job progress to 50%
                        if(isSuccess) {
                            await this.finish(job, name);
                        }
                        else{
                            await this.fail(job, "Failed");
                        }
                        clearTimeout(fnTimeout);
                    } catch(err) {
                        await this.fail(job, err.toString());
                    }
                    this.emitEvent('jobFinished', job);
                });
                if (this.parallelExecution) {
                    await Promise.all(promises);
                } else {
                    for (const promise of promises) {
                        await promise;
                    }
                }
            } else {
                for (const job of jobs) {
                    await this.fail(job, `Runner ${name} not defined`);
                }
                throw new Error('Runner not defined');
            }
        } catch(e) {
            console.log(e);
            this.logger.error('Error running job:', e);
        }
    }

    async requeueJob(name, documentId) {
        try {
            let doc = await this.db.collection(this.getDbCollectionName(name)).findOne({
                _id: documentId
            });
            await this.fail(doc, "Unknown, manually Requeued", true);
        } catch(e) {
            console.log(e);
            this.logger.error('Error requeuing job:', e);
        }
    }

    async scheduleRecurringJob(name, cronExpression, jobData, identifier, priority = 0) {
        cron.schedule(cronExpression, async () => {
            await this.now(jobData, name, identifier, Date.now(), priority);
        });
    }

    async addPlugin(plugin) {
        this.plugins.push(plugin);
    }

    async emitEvent(event, data) {
        if (this.eventHooks[event]) {
            for (let hook of this.eventHooks[event]) {
                await hook(data);
            }
        }
    }

    async on(event, hook) {
        if (!this.eventHooks[event]) {
            this.eventHooks[event] = [];
        }
        this.eventHooks[event].push(hook);
    }

    async notifySystems(event, data) {
        await notifySystems(this.notificationConfig, event, data);
    }

    async registerWorker() {
        try {
            await this.redisClient.sadd('workers', this.workerId);
        } catch (e) {
            console.log(e);
            this.logger.error('Error registering worker:', e);
        }
    }

    async deregisterWorker() {
        try {
            await this.redisClient.srem('workers', this.workerId);
        } catch (e) {
            console.log(e);
            this.logger.error('Error deregistering worker:', e);
        }
    }

    async startHeartbeat() {
        setInterval(async () => {
            try {
                await this.redisClient.set(`worker:${this.workerId}:heartbeat`, Date.now(), 'PX', this.workerTimeout);
            } catch (e) {
                console.log(e);
                this.logger.error('Error starting heartbeat:', e);
            }
        }, this.workerTimeout / 2);
    }

    async redistributeJobs() {
        try {
            const workers = await this.redisClient.smembers('workers');
            if (workers.length === 0) {
                return;
            }

            const jobs = await this.getCurrentQueue('myJob');
            for (let job of jobs) {
                const workerIndex = Math.floor(Math.random() * workers.length);
                const workerId = workers[workerIndex];
                await this.pushToQueue(job, 'myJob', job.identifier, Date.now(), 0, 0);
            }
        } catch (e) {
            console.log(e);
            this.logger.error('Error redistributing jobs:', e);
        }
    }

    async validateJobData(name, data) {
        if (this.jobSchemas[name]) {
            const validate = this.ajv.compile(this.jobSchemas[name]);
            const valid = validate(data);
            if (!valid) {
                throw new Error(`Job data validation failed: ${JSON.stringify(validate.errors)}`);
            }
        }
    }

    async checkJobDependencies(name) {
        if (this.jobDependencies[name]) {
            for (let dependency of this.jobDependencies[name]) {
                const dependencyCount = await this.getQueueLength(dependency);
                if (dependencyCount > 0) {
                    throw new Error(`Job dependency not met: ${dependency}`);
                }
            }
        }
    }

    async getMetrics() {
        return this.metrics;
    }

    progress(job, progress) {
        job.progress = progress;
    }

    async schedule(name, cronExpression, jobFunction) {
        cron.schedule(cronExpression, async () => {
            await jobFunction();
        });
    }
}

module.exports = {
    PopQueue
};
