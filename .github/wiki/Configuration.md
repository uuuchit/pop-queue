# Configuration

This page provides documentation for configuring the `pop-queue` library and setting environment variables.

## Environment Variables

The following environment variables can be set to configure the `pop-queue` library:

- `NODE_ENV`: The environment in which the application is running (e.g., `production`, `development`).
- `DB_URL`: The URL of the MongoDB database.
- `REDIS_URL`: The URL of the Redis server.
- `MEMCACHED_URL`: The URL of the Memcached server (optional).
- `POSTGRES_URL`: The URL of the PostgreSQL server (optional).
- `WORKER_ID`: The unique identifier for the worker.
- `WORKER_TIMEOUT`: The timeout duration for the worker (in milliseconds).
- `RATE_LIMIT`: The rate limit for job processing.
- `CONCURRENCY`: The maximum number of concurrent jobs being processed.
- `BACKOFF_STRATEGY`: The backoff strategy for job retries (e.g., `{"type":"exponential","delay":1000}`).
- `BATCH_SIZE`: The batch size for job processing.
- `PARALLEL_EXECUTION`: Whether to enable parallel execution of jobs.
- `REDIS_PIPELINING`: Whether to enable Redis pipelining.
- `NOTIFICATION_CONFIG`: The configuration for notifications.

## Configuration File

In addition to environment variables, you can also configure the `pop-queue` library using a configuration file. The configuration file should be named `config.json` and placed in the root directory of the project.

Here is an example `config.json` file:

```json
{
  "dbUrl": "mongodb://localhost:27017",
  "redisUrl": "redis://localhost:6379",
  "memcachedUrl": "memcached://localhost:11211",
  "postgresUrl": "postgres://localhost:5432",
  "dbName": "myDatabase",
  "collectionName": "myCollection",
  "retries": 3,
  "workerId": "worker-123",
  "workerTimeout": 30000,
  "rateLimit": 100,
  "concurrency": 5,
  "backoffStrategy": {
    "type": "exponential",
    "delay": 1000
  },
  "batchSize": 1000,
  "parallelExecution": true,
  "redisPipelining": true,
  "notificationConfig": {}
}
```

## Validating Configuration Values

The `pop-queue` library validates the configuration values to ensure they are set correctly. If any required configuration value is missing or invalid, an error will be thrown.

The following configuration values are required:

- `dbUrl`
- `redisUrl`
- `memcachedUrl`
- `postgresUrl`
- `dbName`
- `collectionName`
- `retries`
- `workerId`
- `workerTimeout`
- `rateLimit`
- `concurrency`
- `backoffStrategy`
- `batchSize`
- `parallelExecution`
- `redisPipelining`
- `notificationConfig`

## Example

Here is an example of how to configure the `pop-queue` library using environment variables and a configuration file:

1. Create a `.env` file in the root directory of the project and add the following environment variables:

```env
NODE_ENV=production
DB_URL=mongodb://yourMongoDbUrl:27017
REDIS_URL=redis://yourRedisUrl:6379
MEMCACHED_URL=memcached://yourMemcachedUrl:11211
POSTGRES_URL=postgres://yourPostgresUrl:5432
WORKER_ID=yourWorkerId
WORKER_TIMEOUT=30000
RATE_LIMIT=100
CONCURRENCY=5
BACKOFF_STRATEGY={"type":"exponential","delay":1000}
BATCH_SIZE=1000
PARALLEL_EXECUTION=true
REDIS_PIPELINING=true
NOTIFICATION_CONFIG={}
```

2. Create a `config.json` file in the root directory of the project and add the following configuration values:

```json
{
  "dbUrl": "mongodb://localhost:27017",
  "redisUrl": "redis://localhost:6379",
  "memcachedUrl": "memcached://localhost:11211",
  "postgresUrl": "postgres://localhost:5432",
  "dbName": "myDatabase",
  "collectionName": "myCollection",
  "retries": 3,
  "workerId": "worker-123",
  "workerTimeout": 30000,
  "rateLimit": 100,
  "concurrency": 5,
  "backoffStrategy": {
    "type": "exponential",
    "delay": 1000
  },
  "batchSize": 1000,
  "parallelExecution": true,
  "redisPipelining": true,
  "notificationConfig": {}
}
```

3. Start the application using npm:

```bash
npm start
```

The application should now be running with the specified configuration values.
