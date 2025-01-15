const Redis =  require('ioredis');

async function redisClient(redis) {
    return new Redis(redis)
}

module.exports = {
    redisClient
}