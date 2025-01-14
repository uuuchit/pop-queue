# Integration Guidelines

## Prerequisites

Before integrating `pop-queue` into your project, make sure you have the following prerequisites:

- Node.js (version 14 or higher)
- npm (Node Package Manager)
- MongoDB
- Redis
- Memcached (optional)
- PostgreSQL (optional)

## Step 1: Install the Library

Install the `pop-queue` library using npm:

```bash
npm install pop-queue
```

## Step 2: Import the Library

Import the `pop-queue` library in your project:

```javascript
const { PopQueue } = require('pop-queue');
```

## Step 3: Create a Queue

Create a queue by instantiating the `PopQueue` class with the required parameters:

```javascript
const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);
```

## Step 4: Define Jobs

Define jobs using the `define` method:

```javascript
queue.define('myJob', async (job) => {
  console.log('Processing job:', job);
  // Perform job processing logic here
  return true;
});
```

## Step 5: Enqueue Jobs

Enqueue jobs using the `now` method:

```javascript
queue.now({ data: 'jobData' }, 'myJob', 'jobIdentifier', Date.now());
```

## Step 6: Start the Queue

Start the queue using the `start` method:

```javascript
queue.start();
```

## Example

Here is a complete example of integrating `pop-queue` into your project:

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

## Additional Integration Guidelines

### gRPC Endpoints

To integrate gRPC endpoints, follow these steps:

1. Define the gRPC service and methods in a `.proto` file.
2. Load the `.proto` file using `protoLoader`.
3. Implement the gRPC service methods.
4. Start the gRPC server.

For detailed instructions, please visit the [gRPC Endpoints](https://github.com/uuuchit/pop-queue/wiki/gRPC-Endpoints) page in the GitHub wiki.

### REST API Endpoints

To integrate REST API endpoints, follow these steps:

1. Create an Express application.
2. Define the REST API routes and handlers.
3. Start the Express server.

For detailed instructions, please visit the [API Endpoints](https://github.com/uuuchit/pop-queue/wiki/API-Endpoints) page in the GitHub wiki.

### Job Management UI

To integrate the job management UI, follow these steps:

1. Create an HTML file for the UI.
2. Create a CSS file for styling the UI.
3. Create a JavaScript file for handling UI interactions.
4. Serve the UI files using an Express application.

For detailed instructions, please visit the [Job Management UI](https://github.com/uuuchit/pop-queue/wiki/Job-Management-UI) page in the GitHub wiki.

### Configuration and Environment Variables

To configure the `pop-queue` library, create a `.env` file in the root directory of your project and add the required environment variables. For detailed instructions, please visit the [Configuration](https://github.com/uuuchit/pop-queue/wiki/Configuration) page in the GitHub wiki.

### Error Handling

To handle errors in API endpoints and queue operations, follow these guidelines:

1. Use try-catch blocks to catch and handle errors.
2. Log errors using a logging library such as `winston`.
3. Return appropriate error responses in API endpoints.

For detailed instructions, please visit the [Error Handling](https://github.com/uuuchit/pop-queue/wiki/Error-Handling) page in the GitHub wiki.
