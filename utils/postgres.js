const { Client } = require('pg');

async function postgresClient(url) {
    const client = new Client({
        connectionString: url,
    });
    await client.connect();
    console.log('Connected successfully to PostgreSQL server');
    return client;
}

module.exports = {
    postgresClient,
};
