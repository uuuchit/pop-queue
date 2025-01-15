const { redisClient } = require('../utils/redis.js');
const { memcachedClient } = require('../utils/memcached.js');
const { default: Redlock } = require("redlock");
const config = require('../config/config.js');
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

async function connectRedis(redisUrl, redisClusterConfig) {
    try {
        let rClient;
        if (redisClusterConfig) {
            rClient = new Redis.Cluster(redisClusterConfig);
            console.log('Redis cluster connected');
        } else if (redisUrl.startsWith('memcached://')) {
            rClient = await memcachedClient(redisUrl);
            console.log('Memcached connected');
        } else {
            rClient = await redisClient(redisUrl);
            console.log('Redis connected');
        }
        const redlock = new Redlock([rClient], {
            retryCount: 10,
            retryDelay: 200
        });
        return { rClient, redlock };
    } catch (e) {
        console.log(e);
        logger.error('Error connecting to Redis:', e);
    }
}

module.exports = {
    connectRedis
};
