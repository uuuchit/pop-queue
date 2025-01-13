# pop-queue

## Overview

`pop-queue` is a library for managing job queues using MongoDB and Redis. It allows you to define, enqueue, and process jobs with ease. The library is designed to handle high concurrency and large-scale systems.

## Installation

To install the library, use npm:

```bash
npm install pop-queue
```

## Usage

### Importing the Library

To use the library, import it in your project:

```javascript
const { PopQueue } = require('pop-queue');
```

### Creating a Queue

To create a queue, instantiate the `PopQueue` class with the required parameters:

```javascript
const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);
```

### Defining a Job

To define a job, use the `define` method:

```javascript
queue.define('myJob', async (job) => {
  // Job processing logic
  console.log('Processing job:', job);
  return true; // Return true if the job is successful, false otherwise
});
```

### Enqueuing a Job

To enqueue a job, use the `now` method:

```javascript
queue.now({ data: 'myJobData' }, 'myJob', 'jobIdentifier', Date.now());
```

### Starting the Queue

To start the queue, use the `start` method:

```javascript
queue.start();
```

## Integration Guidelines

To integrate `pop-queue` into your project, follow these steps:

1. Install the library using npm.
2. Import the library in your project.
3. Create a queue by instantiating the `PopQueue` class with the required parameters.
4. Define jobs using the `define` method.
5. Enqueue jobs using the `now` method.
6. Start the queue using the `start` method.

## Examples

### Example 1: Basic Usage

```javascript
const { PopQueue } = require('pop-queue');

const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);

queue.define('myJob', async (job) => {
  console.log('Processing job:', job);
  return true;
});

queue.now({ data: 'myJobData' }, 'myJob', 'jobIdentifier', Date.now());

queue.start();
```

### Example 2: Handling Failures

```javascript
const { PopQueue } = require('pop-queue');

const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);

queue.define('myJob', async (job) => {
  console.log('Processing job:', job);
  if (job.data === 'fail') {
    return false;
  }
  return true;
});

queue.now({ data: 'fail' }, 'myJob', 'jobIdentifier', Date.now());

queue.start();
```

## Scaling and Performance

To scale the library for millions of users and sessions, consider the following:

1. Use Redis locks to handle race conditions.
2. Optimize MongoDB and Redis queries for better performance.
3. Use sharding and replication for MongoDB to distribute the load.
4. Use Redis clustering to handle large datasets and high throughput.
5. Monitor the performance of your system and adjust the configuration as needed.

## MongoDB Sharding

MongoDB sharding is a method for distributing data across multiple servers. It allows you to horizontally scale your database by partitioning data into smaller, more manageable pieces called shards. Each shard is a separate database that contains a subset of the data. MongoDB automatically balances the data across shards and routes queries to the appropriate shard.

To enable sharding in your MongoDB deployment, follow these steps:

1. Enable sharding on your database:
   ```javascript
   sh.enableSharding("myDatabase")
   ```

2. Shard a collection:
   ```javascript
   sh.shardCollection("myDatabase.myCollection", { "shardKey": 1 })
   ```

## Redis Clustering

Redis clustering is a method for partitioning data across multiple Redis nodes. It allows you to horizontally scale your Redis deployment by distributing data across multiple nodes. Redis clustering provides high availability and fault tolerance by automatically failing over to a replica node in case of a node failure.

To enable Redis clustering in your Redis deployment, follow these steps:

1. Create a Redis cluster configuration file:
   ```bash
   port 7000
   cluster-enabled yes
   cluster-config-file nodes.conf
   cluster-node-timeout 5000
   appendonly yes
   ```

2. Start Redis nodes with the cluster configuration file:
   ```bash
   redis-server /path/to/redis.conf
   ```

3. Create the Redis cluster:
   ```bash
   redis-cli --cluster create 127.0.0.1:7000 127.0.0.1:7001 127.0.0.1:7002 --cluster-replicas 1
   ```

## Job Management UI

A new UI has been added to manage jobs. The UI allows you to view job details and requeue jobs.

### Accessing the UI

To access the UI, open `pop-queue/ui/index.html` in your browser.

### UI Structure

The UI consists of the following components:

- A container for job management tasks.
- A button to requeue jobs.

### UI Files

The UI files are located in the `pop-queue/ui` directory:

- `index.html`: The main HTML file for the UI.
- `styles.css`: The CSS file for styling the UI.
- `app.js`: The JavaScript file for handling UI interactions.

## API Endpoints

New API endpoints have been added to get job details and requeue jobs.

### Getting Job Details

To get job details, send a GET request to `/api/job-details`.

Example:

```bash
curl -X GET http://localhost:3000/api/job-details
```

### Requeuing a Job

To requeue a job, send a POST request to `/api/requeue-job` with the job ID in the request body.

Example:

```bash
curl -X POST http://localhost:3000/api/requeue-job -H "Content-Type: application/json" -d '{"jobId": "yourJobId"}'
```

## Configuration

To use this package, you need to create a configuration file and set environment variables for sensitive data. The configuration file should be named `config.json` and placed in the root directory of your project.

### Configuration File

Create a `config.json` file with the following structure:

```json
{
  "dbUrl": "mongodb://localhost:27017",
  "redisUrl": "redis://localhost:6379",
  "dbName": "myDatabase",
  "collectionName": "myCollection",
  "retries": 3
}
```

### Environment Variables

Set the following environment variables for sensitive data:

- `DB_URL`: MongoDB connection URL (default: `mongodb://localhost:27017`)
- `REDIS_URL`: Redis connection URL (default: `redis://localhost:6379`)

Example:

```bash
export DB_URL="mongodb://yourMongoDbUrl:27017"
export REDIS_URL="redis://yourRedisUrl:6379"
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on GitHub.

## License

This project is licensed under the ISC License.
