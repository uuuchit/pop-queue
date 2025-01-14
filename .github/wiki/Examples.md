# Examples

## Basic Usage

Here is a basic example of using the `pop-queue` library:

```javascript
const { PopQueue } = require('pop-queue');

const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);

queue.define('myJob', async (job) => {
  console.log('Processing job:', job);
  // Perform job processing logic here
  return true;
});

queue.now({ data: 'jobData' }, 'myJob', 'jobIdentifier', Date.now());

queue.start();
```

## Handling Failures

To handle job failures, you can use the `fail` method:

```javascript
queue.define('myJob', async (job) => {
  try {
    console.log('Processing job:', job);
    // Perform job processing logic here
    return true;
  } catch (error) {
    await queue.fail(job, error.message);
    return false;
  }
});
```

## Using Memcached

To use Memcached as a storage backend, provide the Memcached URL when creating the queue:

```javascript
const queue = new PopQueue('memcached://localhost:11211', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);
```

## Using PostgreSQL

To use PostgreSQL as a storage backend, provide the PostgreSQL URL when creating the queue:

```javascript
const queue = new PopQueue('postgres://localhost:5432', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);
```

## Job Rate Limiting and Concurrency Control

To limit the rate of job processing and control concurrency, set the `rateLimit` and `concurrency` options:

```javascript
const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);
queue.rateLimit = 100; // Limit to 100 jobs per second
queue.concurrency = 5; // Limit to 5 concurrent jobs
```

## Job Retries and Backoff Strategies

To configure job retries and backoff strategies, set the `retries` and `backoffStrategy` options:

```javascript
const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);
queue.retries = 3; // Retry failed jobs 3 times
queue.backoffStrategy = { type: 'exponential', delay: 1000 }; // Exponential backoff with 1 second delay
```

## Job Progress Tracking and Completion Callbacks

To track job progress and receive completion callbacks, use the `progress` and `completionCallback` methods:

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

To validate job data against predefined schemas, use the `ajv` library:

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

To define dependencies between jobs and control their execution flow, use the `jobDependencies` option:

```javascript
queue.define('dependentJob', async (job) => {
  console.log('Processing dependent job:', job);
  // Perform job processing logic here
  return true;
}, { dependencies: ['myJob'] });
```

## Built-in Metrics and Monitoring Tools

To monitor job queue performance and track metrics, use the `metrics` property:

```javascript
const metrics = queue.metrics;
console.log('Jobs processed:', metrics.jobsProcessed);
console.log('Jobs failed:', metrics.jobsFailed);
console.log('Jobs succeeded:', metrics.jobsSucceeded);
console.log('Job duration:', metrics.jobDuration);
```

## Job Events and Listeners

To emit and listen to job-related events, use the `emitEvent` and `on` methods:

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

## Image Resizing and Processing Job Queue

To create an image resizing and processing job queue, use the `sharp` library:

```javascript
const sharp = require('sharp');

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

## Sending Bulk Emails to Users

To create a job queue for sending bulk emails to users, use the `nodemailer` library:

```javascript
const nodemailer = require('nodemailer');

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
