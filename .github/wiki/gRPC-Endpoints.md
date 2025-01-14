# gRPC Endpoints

## Get Job Details

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

## Requeue Job

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

## Register Worker

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

## Deregister Worker

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

## Redistribute Jobs

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
