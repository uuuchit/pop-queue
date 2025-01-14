# New Features

## Job Prioritization and Delayed Jobs

The `pop-queue` library allows you to prioritize jobs and delay their execution. You can set the `priority` and `delay` options when enqueuing a job.

Example:

```javascript
queue.now({ data: 'jobData' }, 'myJob', 'jobIdentifier', Date.now(), 10, 5000); // Priority 10, delay 5000ms
```

## Rate Limiting and Concurrency Control

The `pop-queue` library provides rate limiting and concurrency control to manage the rate of job processing and the number of concurrent jobs. You can set the `rateLimit` and `concurrency` options when creating the queue.

Example:

```javascript
const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);
queue.rateLimit = 100; // Limit to 100 jobs per second
queue.concurrency = 5; // Limit to 5 concurrent jobs
```

## Job Retries and Backoff Strategies

The `pop-queue` library supports job retries and backoff strategies to handle job failures. You can set the `retries` and `backoffStrategy` options when creating the queue.

Example:

```javascript
const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);
queue.retries = 3; // Retry failed jobs 3 times
queue.backoffStrategy = { type: 'exponential', delay: 1000 }; // Exponential backoff with 1 second delay
```

## Job Events and Listeners

The `pop-queue` library allows you to emit and listen to job-related events. You can use the `emitEvent` and `on` methods to handle job events.

Example:

```javascript
queue.on('jobFinished', (job) => {
  console.log('Job finished:', job);
});

queue.define('myJob', async (job) => {
  console.log('Processing job:', job);
  // Perform job processing logic here
  queue.emitEvent('jobFinished', job);
  return true;
});
```

## Job Progress Tracking and Completion Callbacks

The `pop-queue` library provides job progress tracking and completion callbacks. You can use the `progress` and `completionCallback` methods to track job progress and receive completion callbacks.

Example:

```javascript
queue.define('myJob', async (job) => {
  console.log('Processing job:', job);
  // Perform job processing logic here
  queue.progress(job, 50); // Update job progress to 50%
  // Perform more job processing logic here
  queue.completionCallback(job, () => {
    console.log('Job completed:', job);
  });
  return true;
});
```

## Job Data Schema Validation

The `pop-queue` library allows you to validate job data against predefined schemas. You can use the `ajv` library to define and validate job data schemas.

Example:

```javascript
const Ajv = require('ajv');
const ajv = new Ajv();

const jobSchema = {
  type: 'object',
  properties: {
    data: { type: 'string' }
  },
  required: ['data']
};

queue.define('myJob', async (job) => {
  const validate = ajv.compile(jobSchema);
  const valid = validate(job.data);
  if (!valid) {
    throw new Error('Invalid job data');
  }
  console.log('Processing job:', job);
  // Perform job processing logic here
  return true;
});
```

## Job Dependencies and Flow Control

The `pop-queue` library allows you to define dependencies between jobs and control their execution flow. You can use the `jobDependencies` option to specify job dependencies.

Example:

```javascript
queue.define('dependentJob', async (job) => {
  console.log('Processing dependent job:', job);
  // Perform job processing logic here
  return true;
}, { dependencies: ['myJob'] });
```

## Built-in Metrics and Monitoring Tools

The `pop-queue` library provides built-in metrics and monitoring tools to track job queue performance. You can use the `metrics` property to access job queue metrics.

Example:

```javascript
const metrics = queue.metrics;
console.log('Jobs processed:', metrics.jobsProcessed);
console.log('Jobs failed:', metrics.jobsFailed);
console.log('Jobs succeeded:', metrics.jobsSucceeded);
console.log('Job duration:', metrics.jobDuration);
```
