const Memcached = require('memcached');

async function memcachedClient(memcachedUrl) {
    const client = new Memcached(memcachedUrl);
    console.log('Connected successfully to Memcached server');
    return client;
}

module.exports = {
    memcachedClient
};
