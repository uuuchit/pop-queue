# Core Features

## Task Scheduling

The `pop-queue` library allows you to schedule tasks to be executed at specific times or intervals. You can use the `schedule` method to define a task and specify its execution schedule using cron expressions.

Example:

```javascript
const { PopQueue } = require('pop-queue');

const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);

queue.schedule('myTask', '0 0 * * *', async (job) => {
  console.log('Executing scheduled task:', job);
  // Perform task logic here
  return true;
});

queue.start();
```

## Concurrency Control

The `pop-queue` library provides concurrency control to limit the number of concurrent tasks being executed. You can set the `concurrency` option when creating the queue to specify the maximum number of concurrent tasks.

Example:

```javascript
const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3, { concurrency: 5 });
```

## Persistence

The `pop-queue` library supports multiple storage backends, including MongoDB, Redis, Memcached, and PostgreSQL, to persist job data. You can configure the storage backend by providing the appropriate connection URLs when creating the queue.

Example:

```javascript
const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);
```

## Distributed Execution

The `pop-queue` library supports distributed execution of tasks across multiple worker instances. You can register and deregister workers using the `registerWorker` and `deregisterWorker` methods, and the library will automatically distribute tasks among the available workers.

Example:

```javascript
queue.registerWorker();
queue.deregisterWorker();
```

## Fault Tolerance

The `pop-queue` library provides fault tolerance by automatically retrying failed tasks with configurable backoff strategies. You can set the `retries` and `backoffStrategy` options when creating the queue to specify the number of retries and the backoff strategy.

Example:

```javascript
const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3, { retries: 3, backoffStrategy: { type: 'exponential', delay: 1000 } });
```
