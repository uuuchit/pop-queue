# pop-queue

## Overview

`pop-queue` is a library for managing job queues using MongoDB, Redis, Memcached, and PostgreSQL. It allows you to define, enqueue, and process jobs with ease. The library is designed to handle high concurrency and large-scale systems.

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

### Example 3: Using Memcached

```javascript
const { PopQueue } = require('pop-queue');

const queue = new PopQueue('mongodb://localhost:27017', 'memcached://localhost:11211', 'myDatabase', 'myCollection', 3);

queue.define('myJob', async (job) => {
  console.log('Processing job:', job);
  return true;
});

queue.now({ data: 'myJobData' }, 'myJob', 'jobIdentifier', Date.now());

queue.start();
```

### Example 4: Using PostgreSQL

```javascript
const { PopQueue } = require('pop-queue');

const queue = new PopQueue('postgres://localhost:5432', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);

queue.define('myJob', async (job) => {
  console.log('Processing job:', job);
  return true;
});

queue.now({ data: 'myJobData' }, 'myJob', 'jobIdentifier', Date.now());

queue.start();
```

### Example 5: Job Rate Limiting and Concurrency Control

```javascript
const { PopQueue } = require('pop-queue');

const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);

queue.define('myJob', async (job) => {
  console.log('Processing job:', job);
  return true;
}, {
  rateLimit: 10, // Limit to 10 jobs per second
  concurrency: 5 // Allow up to 5 concurrent jobs
});

queue.now({ data: 'myJobData' }, 'myJob', 'jobIdentifier', Date.now());

queue.start();
```

### Example 6: Job Retries and Backoff Strategies

```javascript
const { PopQueue } = require('pop-queue');

const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);

queue.define('myJob', async (job) => {
  console.log('Processing job:', job);
  if (job.data === 'fail') {
    return false;
  }
  return true;
}, {
  retries: 3, // Retry up to 3 times
  backoff: {
    type: 'exponential', // Use exponential backoff strategy
    delay: 1000 // Start with a 1-second delay
  }
});

queue.now({ data: 'fail' }, 'myJob', 'jobIdentifier', Date.now());

queue.start();
```

### Example 7: Job Progress Tracking and Completion Callbacks

```javascript
const { PopQueue } = require('pop-queue');

const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);

queue.define('myJob', async (job) => {
  console.log('Processing job:', job);
  job.progress = 50; // Update job progress to 50%
  await queue.emitEvent('jobProgress', job);
  return true;
}, {
  completionCallback: async (job) => {
    console.log('Job completed:', job);
  }
});

queue.now({ data: 'myJobData' }, 'myJob', 'jobIdentifier', Date.now());

queue.start();
```

### Example 8: Job Data Schema Validation

```javascript
const { PopQueue } = require('pop-queue');
const Ajv = require('ajv');

const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);

const ajv = new Ajv();
const schema = {
  type: 'object',
  properties: {
    data: { type: 'string' }
  },
  required: ['data']
};

queue.define('myJob', async (job) => {
  console.log('Processing job:', job);
  return true;
}, {
  schema: ajv.compile(schema)
});

queue.now({ data: 'myJobData' }, 'myJob', 'jobIdentifier', Date.now());

queue.start();
```

### Example 9: Job Dependencies and Flow Control

```javascript
const { PopQueue } = require('pop-queue');

const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);

queue.define('dependentJob', async (job) => {
  console.log('Processing dependent job:', job);
  return true;
});

queue.define('mainJob', async (job) => {
  console.log('Processing main job:', job);
  return true;
}, {
  dependencies: ['dependentJob'] // Ensure dependentJob is completed before mainJob
});

queue.now({ data: 'dependentJobData' }, 'dependentJob', 'dependentJobIdentifier', Date.now());
queue.now({ data: 'mainJobData' }, 'mainJob', 'mainJobIdentifier', Date.now());

queue.start();
```

### Example 10: Built-in Metrics and Monitoring Tools

```javascript
const { PopQueue } = require('pop-queue');

const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);

queue.define('myJob', async (job) => {
  console.log('Processing job:', job);
  return true;
});

queue.now({ data: 'myJobData' }, 'myJob', 'jobIdentifier', Date.now());

queue.start();

setInterval(async () => {
  const metrics = await queue.getMetrics();
  console.log('Queue metrics:', metrics);
}, 10000); // Log metrics every 10 seconds
```

### Example 11: Job Events and Listeners

```javascript
const { PopQueue } = require('pop-queue');

const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);

queue.on('jobFinished', async (job) => {
  console.log('Job finished:', job);
});

queue.define('myJob', async (job) => {
  console.log('Processing job:', job);
  return true;
});

queue.now({ data: 'myJobData' }, 'myJob', 'jobIdentifier', Date.now());

queue.start();
```

### Example 12: Image Resizing and Processing Job Queue

```javascript
const { PopQueue } = require('pop-queue');
const sharp = require('sharp');

const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);

queue.define('imageResizingJob', async (job) => {
  console.log('Processing image resizing job:', job);
  const { inputPath, outputPath, width, height } = job.data;
  await sharp(inputPath)
    .resize(width, height)
    .toFile(outputPath);
  return true;
});

queue.now({ inputPath: 'input.jpg', outputPath: 'output.jpg', width: 800, height: 600 }, 'imageResizingJob', 'imageResizingJobIdentifier', Date.now());

queue.start();
```

### Example 13: Sending Bulk Emails to Users

```javascript
const { PopQueue } = require('pop-queue');
const nodemailer = require('nodemailer');

const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-email-password'
  }
});

queue.define('bulkEmailJob', async (job) => {
  console.log('Processing bulk email job:', job);
  const { to, subject, text } = job.data;
  await transporter.sendMail({
    from: 'your-email@gmail.com',
    to,
    subject,
    text
  });
  return true;
});

queue.now({ to: 'user@example.com', subject: 'Hello', text: 'This is a bulk email.' }, 'bulkEmailJob', 'bulkEmailJobIdentifier', Date.now());

queue.start();
```

## Scaling and Performance

To scale the library for millions of users and sessions, consider the following:

1. Use Redis locks to handle race conditions.
2. Optimize MongoDB, Redis, Memcached, and PostgreSQL queries for better performance.
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

## gRPC Endpoints

New gRPC endpoints have been added to allow non-JavaScript applications to interact with the job system.

### Getting Job Details

To get job details, use the `GetJobDetails` gRPC method.

Example:

```protobuf
syntax = "proto3";

package popqueue;

service PopQueue {
  rpc GetJobDetails (JobDetailsRequest) returns (JobDetailsResponse);
}

message JobDetailsRequest {}

message JobDetailsResponse {
  repeated JobDetail jobDetails = 1;
}

message JobDetail {
  string name = 1;
  string identifier = 2;
  string status = 3;
  string createdAt = 4;
  string pickedAt = 5;
  string finishedAt = 6;
}
```

### Requeuing a Job

To requeue a job, use the `RequeueJob` gRPC method.

Example:

```protobuf
syntax = "proto3";

package popqueue;

service PopQueue {
  rpc RequeueJob (RequeueJobRequest) returns (RequeueJobResponse);
}

message RequeueJobRequest {
  string jobId = 1;
}

message RequeueJobResponse {
  string message = 1;
}
```

## Configuration

To use this package, you need to create a configuration file and set environment variables for sensitive data. The configuration file should be named `config.json` and placed in the root directory of your project.

### Configuration File

Create a `config.json` file with the following structure:

```json
{
  "dbUrl": "mongodb://localhost:27017",
  "redisUrl": "redis://localhost:6379",
  "memcachedUrl": "memcached://localhost:11211",
  "postgresUrl": "postgres://localhost:5432",
  "dbName": "myDatabase",
  "collectionName": "myCollection",
  "retries": 3,
  "notificationConfig": {
    "webhook": {
      "url": "https://example.com/webhook"
    },
    "email": {
      "smtpConfig": {
        "host": "smtp.example.com",
        "port": 587,
        "secure": false,
        "auth": {
          "user": "user@example.com",
          "pass": "password"
        }
      },
      "from": "no-reply@example.com",
      "to": "admin@example.com"
    },
    "slack": {
      "token": "xoxb-your-slack-token",
      "channel": "#notifications"
    }
  }
}
```

### Environment Variables

Set the following environment variables for sensitive data:

- `DB_URL`: MongoDB or PostgreSQL connection URL (default: `mongodb://localhost:27017`)
- `REDIS_URL`: Redis or Memcached connection URL (default: `redis://localhost:6379`)

Example:

```bash
export DB_URL="mongodb://yourMongoDbUrl:27017"
export REDIS_URL="redis://yourRedisUrl:6379"
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on GitHub.

## License

This project is licensed under the ISC License.

## Core Features

### Task Scheduling

- **Priority-based execution**: Allow tasks to have different priorities and execute high-priority tasks first.
- **Delayed jobs**: Schedule tasks to run after a specific delay.
- **Recurring jobs**: Support cron-like recurring tasks.
- **Immediate jobs**: Execute tasks immediately upon submission.

### Concurrency Control

- **Worker pools**: Limit the number of tasks being processed simultaneously.
- **Rate limiting**: Prevent tasks from overloading the system by capping execution rates.
- **Resource-aware execution**: Dynamically adjust concurrency based on available resources (e.g., CPU, memory).

### Persistence

- **Task durability**: Store tasks persistently so they survive application crashes or restarts.
- **Retry policies**: Automatically retry failed tasks based on predefined rules.
- **Dead letter queues**: Move repeatedly failing tasks to a separate queue for manual review.

### Distributed Execution

- **Cluster support**: Allow multiple instances of the application to process jobs in parallel.
- **Load balancing**: Distribute jobs evenly across available workers.
- **Fault tolerance**: Handle worker failures gracefully by redistributing uncompleted tasks.

#### Registering and Deregistering Worker Instances

To register a worker instance, use the `registerWorker` method:

```javascript
queue.registerWorker();
```

To deregister a worker instance, use the `deregisterWorker` method:

```javascript
queue.deregisterWorker();
```

### Fault Tolerance

To handle worker failures gracefully and redistribute uncompleted tasks, use the `redistributeJobs` method:

```javascript
queue.redistributeJobs();
```

### Running Multiple `pop-queue` Jobs on Different Nodes in Kubernetes

To run multiple `pop-queue` jobs on different nodes in Kubernetes, follow these steps:

1. Create a Kubernetes deployment for `pop-queue`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pop-queue
spec:
  replicas: 3
  selector:
    matchLabels:
      app: pop-queue
  template:
    metadata:
      labels:
        app: pop-queue
    spec:
      containers:
      - name: pop-queue
        image: your-docker-image
        env:
        - name: DB_URL
          value: "mongodb://yourMongoDbUrl:27017"
        - name: REDIS_URL
          value: "redis://yourRedisUrl:6379"
        - name: MEMCACHED_URL
          value: "memcached://yourMemcachedUrl:11211"
        - name: POSTGRES_URL
          value: "postgres://yourPostgresUrl:5432"
        - name: WORKER_ID
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: WORKER_TIMEOUT
          value: "30000"
```

2. Apply the deployment:

```bash
kubectl apply -f pop-queue-deployment.yaml
```

3. Verify the deployment:

```bash
kubectl get deployments
```

This will allow you to run multiple `pop-queue` jobs on different nodes in Kubernetes, ensuring high availability and fault tolerance.

## New Features

### Job Prioritization and Delayed Jobs

`pop-queue` now supports job prioritization and delayed jobs. You can assign priorities to jobs and schedule them to run after a specific delay.

### Rate Limiting and Concurrency Control

Built-in rate limiting and concurrency control features have been added to `pop-queue`. You can limit the number of tasks being processed simultaneously and prevent tasks from overloading the system by capping execution rates.

### Job Retries and Backoff Strategies

`pop-queue` now supports job retries and backoff strategies. You can automatically retry failed tasks based on predefined rules and implement backoff strategies to handle repeated failures.

### Job Events and Listeners

Support for job events and listeners has been added to `pop-queue`. You can emit events and register listeners to handle specific events during job processing.

### Job Progress Tracking and Completion Callbacks

`pop-queue` now includes job progress tracking and completion callbacks. You can track the progress of jobs and execute callbacks upon job completion.

### Job Data Schema Validation

Support for job data schema validation has been added to `pop-queue`. You can validate job data against predefined schemas to ensure data integrity.

### Job Dependencies and Flow Control

`pop-queue` now supports job dependencies and flow control. You can define dependencies between jobs and control the flow of job execution based on these dependencies.

### Built-in Metrics and Monitoring Tools

Built-in metrics and monitoring tools have been introduced to `pop-queue`. You can monitor the performance of your job queues and gather metrics to optimize your system.
