const fs = require('fs');
const path = require('path');

const configPath = path.resolve(__dirname, 'config.json');

let config = {
    dbUrl: process.env.DB_URL || 'mongodb://localhost:27017',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    dbName: 'myDatabase',
    collectionName: 'myCollection',
    retries: 3,
    workerId: process.env.WORKER_ID || `worker-${Math.random().toString(36).substr(2, 9)}`,
    workerTimeout: process.env.WORKER_TIMEOUT || 30000
};

if (fs.existsSync(configPath)) {
    const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    config = { ...config, ...fileConfig };
}

// Validate configuration values
const requiredConfigKeys = ['dbUrl', 'redisUrl', 'dbName', 'collectionName', 'retries', 'workerId', 'workerTimeout'];
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
});

module.exports = config;
