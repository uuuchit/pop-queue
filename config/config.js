const fs = require('fs');
const path = require('path');

const configPath = path.resolve(__dirname, 'config.json');

let config = {
    dbUrl: process.env.DB_URL || 'mongodb://localhost:27017',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    memcachedUrl: process.env.MEMCACHED_URL || 'memcached://localhost:11211',
    postgresUrl: process.env.POSTGRES_URL || 'postgres://localhost:5432',
    dbName: 'myDatabase',
    collectionName: 'myCollection',
    retries: 3,
    workerId: process.env.WORKER_ID || `worker-${Math.random().toString(36).substr(2, 9)}`,
    workerTimeout: process.env.WORKER_TIMEOUT || 30000,
    rateLimit: process.env.RATE_LIMIT || 100,
    concurrency: process.env.CONCURRENCY || 5,
    backoffStrategy: process.env.BACKOFF_STRATEGY || { type: 'exponential', delay: 1000 },
    batchSize: process.env.BATCH_SIZE || 1000,
    parallelExecution: process.env.PARALLEL_EXECUTION === 'true',
    redisPipelining: process.env.REDIS_PIPELINING === 'true',
    notificationConfig: process.env.NOTIFICATION_CONFIG || {}
};

if (fs.existsSync(configPath)) {
    const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    config = { ...config, ...fileConfig };
}

// Validate configuration values
const requiredConfigKeys = ['dbUrl', 'redisUrl', 'memcachedUrl', 'postgresUrl', 'dbName', 'collectionName', 'retries', 'workerId', 'workerTimeout', 'rateLimit', 'concurrency', 'backoffStrategy', 'batchSize', 'parallelExecution', 'redisPipelining', 'notificationConfig'];
requiredConfigKeys.forEach(key => {
    if (!config[key]) {
        throw new Error(`Missing required configuration value: ${key}`);
    }
    if (key === 'retries' && typeof config[key] !== 'number') {
        throw new Error(`Invalid configuration value for ${key}: must be a number`);
    }
    if (key === 'workerTimeout' && typeof config[key] !== 'number') {
        throw new Error(`Invalid configuration value for ${key}: must be a number`);
    }
    if (key === 'rateLimit' && typeof config[key] !== 'number') {
        throw new Error(`Invalid configuration value for ${key}: must be a number`);
    }
    if (key === 'concurrency' && typeof config[key] !== 'number') {
        throw new Error(`Invalid configuration value for ${key}: must be a number`);
    }
    if (key === 'backoffStrategy' && typeof config[key] !== 'object') {
        throw new Error(`Invalid configuration value for ${key}: must be an object`);
    }
    if (key === 'batchSize' && typeof config[key] !== 'number') {
        throw new Error(`Invalid configuration value for ${key}: must be a number`);
    }
    if (key === 'parallelExecution' && typeof config[key] !== 'boolean') {
        throw new Error(`Invalid configuration value for ${key}: must be a boolean`);
    }
    if (key === 'redisPipelining' && typeof config[key] !== 'boolean') {
        throw new Error(`Invalid configuration value for ${key}: must be a boolean`);
    }
    if (key === 'notificationConfig' && typeof config[key] !== 'object') {
        throw new Error(`Invalid configuration value for ${key}: must be an object`);
    }
});

module.exports = config;
