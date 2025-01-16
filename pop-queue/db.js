const { mongoClient } = require('../utils/mongo');
const { postgresClient } = require('../utils/postgres');
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

async function connectDb(dbUrl, dbName, mongoShardConfig) {
    try {
        let db;
        if (dbUrl.startsWith('postgres://')) {
            db = await postgresClient(dbUrl);
            console.log('PostgreSQL connected');
            await setupPostgresSchema(db);
        } else {
            db = await mongoClient(dbUrl, dbName);
            console.log('MongoDB connected');
            if (mongoShardConfig) {
                await db.admin().command({ enableSharding: dbName });
                await db.admin().command({ shardCollection: `${dbName}.${config.collectionName}`, key: mongoShardConfig });
                console.log('MongoDB sharding enabled');
            }
        }
        return db;
    } catch (e) {
        console.log(e);
        logger.error('Error connecting to database:', e);
    }
}

async function setupPostgresSchema(db) {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS ${config.collectionName} (
            id SERIAL PRIMARY KEY,
            data JSONB,
            createdAt TIMESTAMP,
            name VARCHAR(255),
            identifier VARCHAR(255) UNIQUE,
            priority INT,
            delay INT,
            pickedAt TIMESTAMP,
            finishedAt TIMESTAMP,
            attempts INT DEFAULT 0,
            status VARCHAR(50),
            duration INT,
            requeuedAt TIMESTAMP,
            failedReason JSONB,
            runHistory JSONB
        );
    `;
    await db.query(createTableQuery);
}

module.exports = {
    connectDb
};
