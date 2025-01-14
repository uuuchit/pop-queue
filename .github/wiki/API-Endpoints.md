# API Endpoints

## REST API Endpoints

### Get Job Details

**Endpoint:** `GET /api/job-details`

**Description:** Fetches the details of the current job queue.

**Response:**
- `200 OK`: Returns the job details.
- `500 Internal Server Error`: Failed to fetch job details.

**Example:**
```json
GET /api/job-details
Response:
{
  "jobDetails": [
    {
      "id": 1,
      "name": "testJob",
      "data": "testData",
      "createdAt": "2023-01-01T00:00:00.000Z",
      "pickedAt": "2023-01-01T00:00:00.000Z",
      "finishedAt": "2023-01-01T00:00:00.000Z",
      "status": "done"
    }
  ]
}
```

### Requeue Job

**Endpoint:** `POST /api/requeue-job`

**Description:** Requeues a job with the given job ID.

**Request Body:**
- `jobId` (string): The ID of the job to be requeued.

**Response:**
- `200 OK`: Job requeued successfully.
- `400 Bad Request`: Invalid or missing jobId.
- `500 Internal Server Error`: Failed to requeue job.

**Example:**
```json
POST /api/requeue-job
Request Body:
{
  "jobId": "testJobId"
}
Response:
{
  "message": "Job requeued successfully"
}
```

### Register Worker

**Endpoint:** `POST /api/register-worker`

**Description:** Registers a worker.

**Response:**
- `200 OK`: Worker registered successfully.
- `500 Internal Server Error`: Failed to register worker.

**Example:**
```json
POST /api/register-worker
Response:
{
  "message": "Worker registered successfully"
}
```

### Deregister Worker

**Endpoint:** `POST /api/deregister-worker`

**Description:** Deregisters a worker.

**Response:**
- `200 OK`: Worker deregistered successfully.
- `500 Internal Server Error`: Failed to deregister worker.

**Example:**
```json
POST /api/deregister-worker
Response:
{
  "message": "Worker deregistered successfully"
}
```

### Redistribute Jobs

**Endpoint:** `POST /api/redistribute-jobs`

**Description:** Redistributes jobs among workers.

**Response:**
- `200 OK`: Jobs redistributed successfully.
- `500 Internal Server Error`: Failed to redistribute jobs.

**Example:**
```json
POST /api/redistribute-jobs
Response:
{
  "message": "Jobs redistributed successfully"
}
```

### Enqueue Job

**Endpoint:** `POST /api/now`

**Description:** Enqueues a job with the given data.

**Request Body:**
- `jobData` (object): The data of the job to be enqueued.
- `jobName` (string): The name of the job.
- `jobIdentifier` (string): The identifier of the job.
- `jobScore` (number): The score of the job.
- `priority` (number): The priority of the job.
- `delay` (number): The delay of the job.

**Response:**
- `200 OK`: Job enqueued successfully.
- `500 Internal Server Error`: Failed to enqueue job.

**Example:**
```json
POST /api/now
Request Body:
{
  "jobData": {
    "data": "testData"
  },
  "jobName": "testJob",
  "jobIdentifier": "testIdentifier",
  "jobScore": 1672531200000,
  "priority": 5,
  "delay": 1000
}
Response:
{
  "message": "Job enqueued successfully"
}
```

### Start Loop

**Endpoint:** `POST /api/start-loop`

**Description:** Starts the loop for processing jobs.

**Response:**
- `200 OK`: Loop started successfully.
- `500 Internal Server Error`: Failed to start loop.

**Example:**
```json
POST /api/start-loop
Response:
{
  "message": "Loop started successfully"
}
```

### Fail Job

**Endpoint:** `POST /api/fail`

**Description:** Fails a job with the given data.

**Request Body:**
- `jobData` (object): The data of the job to be failed.
- `reason` (string): The reason for failing the job.
- `force` (boolean): Whether to force fail the job.

**Response:**
- `200 OK`: Job failed successfully.
- `500 Internal Server Error`: Failed to fail job.

**Example:**
```json
POST /api/fail
Request Body:
{
  "jobData": {
    "data": "testData"
  },
  "reason": "testReason",
  "force": false
}
Response:
{
  "message": "Job failed successfully"
}
```

### Emit Event

**Endpoint:** `POST /api/emit-event`

**Description:** Emits an event with the given data.

**Request Body:**
- `event` (string): The name of the event.
- `data` (object): The data of the event.

**Response:**
- `200 OK`: Event emitted successfully.
- `500 Internal Server Error`: Failed to emit event.

**Example:**
```json
POST /api/emit-event
Request Body:
{
  "event": "jobFinished",
  "data": {
    "data": "testData"
  }
}
Response:
{
  "message": "Event emitted successfully"
}
```

### Register Event Listener

**Endpoint:** `POST /api/on`

**Description:** Registers an event listener for the given event.

**Request Body:**
- `event` (string): The name of the event.
- `hook` (function): The event listener function.

**Response:**
- `200 OK`: Event listener registered successfully.
- `500 Internal Server Error`: Failed to register event listener.

**Example:**
```json
POST /api/on
Request Body:
{
  "event": "jobFinished",
  "hook": "function() { console.log('Job finished'); }"
}
Response:
{
  "message": "Event listener registered successfully"
}
```

### Run Job

**Endpoint:** `POST /api/run`

**Description:** Runs a job with the given data.

**Request Body:**
- `jobName` (string): The name of the job.
- `jobIdentifier` (string): The identifier of the job.
- `jobData` (object): The data of the job.

**Response:**
- `200 OK`: Job run successfully.
- `500 Internal Server Error`: Failed to run job.

**Example:**
```json
POST /api/run
Request Body:
{
  "jobName": "testJob",
  "jobIdentifier": "testIdentifier",
  "jobData": {
    "data": "testData"
  }
}
Response:
{
  "message": "Job run successfully"
}
```

## gRPC Endpoints

### Get Job Details

**Method:** `GetJobDetails`

**Description:** Fetches the details of the current job queue.

**Response:**
- `jobDetails` (array): The details of the job queue.

**Example:**
```json
GetJobDetails
Response:
{
  "jobDetails": [
    {
      "id": 1,
      "name": "testJob",
      "data": "testData",
      "createdAt": "2023-01-01T00:00:00.000Z",
      "pickedAt": "2023-01-01T00:00:00.000Z",
      "finishedAt": "2023-01-01T00:00:00.000Z",
      "status": "done"
    }
  ]
}
```

### Requeue Job

**Method:** `RequeueJob`

**Description:** Requeues a job with the given job ID.

**Request:**
- `jobId` (string): The ID of the job to be requeued.

**Response:**
- `message` (string): Job requeued successfully.

**Example:**
```json
RequeueJob
Request:
{
  "jobId": "testJobId"
}
Response:
{
  "message": "Job requeued successfully"
}
```

### Register Worker

**Method:** `RegisterWorker`

**Description:** Registers a worker.

**Response:**
- `message` (string): Worker registered successfully.

**Example:**
```json
RegisterWorker
Response:
{
  "message": "Worker registered successfully"
}
```

### Deregister Worker

**Method:** `DeregisterWorker`

**Description:** Deregisters a worker.

**Response:**
- `message` (string): Worker deregistered successfully.

**Example:**
```json
DeregisterWorker
Response:
{
  "message": "Worker deregistered successfully"
}
```

### Redistribute Jobs

**Method:** `RedistributeJobs`

**Description:** Redistributes jobs among workers.

**Response:**
- `message` (string): Jobs redistributed successfully.

**Example:**
```json
RedistributeJobs
Response:
{
  "message": "Jobs redistributed successfully"
}
```
