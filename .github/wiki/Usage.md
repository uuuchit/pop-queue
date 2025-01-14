# Usage

## Importing the Library

To use the `pop-queue` library in your project, import it as follows:

```javascript
const { PopQueue } = require('pop-queue');
```

## Creating a Queue

Create a queue by instantiating the `PopQueue` class with the required parameters:

```javascript
const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);
```

## Defining a Job

Define a job using the `define` method:

```javascript
queue.define('myJob', async (job) => {
  console.log('Processing job:', job);
  // Perform job processing logic here
  return true;
});
```

## Enqueuing a Job

Enqueue a job using the `now` method:

```javascript
queue.now({ data: 'jobData' }, 'myJob', 'jobIdentifier', Date.now());
```

## Starting the Queue

Start the queue using the `start` method:

```javascript
queue.start();
```

## Example

Here is a complete example of using the `pop-queue` library:

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
