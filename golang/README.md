# pop-queue (Golang)

## Overview

`pop-queue` is a library for managing job queues using MongoDB, Redis, Memcached, and PostgreSQL. It allows you to define, enqueue, and process jobs with ease. The library is designed to handle high concurrency and large-scale systems.

This README provides instructions for using the library with Golang.

## Installation

To install the library, use `go get`:

```bash
go get github.com/uuuchit/pop-queue/golang
```

## Usage

### Importing the Library

To use the library, import it in your project:

```go
import "github.com/uuuchit/pop-queue/golang"
```

### Creating a Queue

To create a queue, instantiate the `Queue` struct with the required parameters:

```go
queue := golang.NewQueue("mongodb://localhost:27017", "redis://localhost:6379", "myDatabase", "myCollection", 3)
```

### Defining a Job

To define a job, use the `Define` method:

```go
queue.Define("myJob", func(job golang.Job) bool {
    // Job processing logic
    fmt.Println("Processing job:", job)
    return true // Return true if the job is successful, false otherwise
})
```

### Enqueuing a Job

To enqueue a job, use the `Now` method:

```go
queue.Now(golang.Job{Data: "myJobData"}, "myJob", "jobIdentifier", time.Now().Unix())
```

### Starting the Queue

To start the queue, use the `Start` method:

```go
queue.Start()
```

## Integration Guidelines

To integrate `pop-queue` into your project, follow these steps:

1. Install the library using `go get`.
2. Import the library in your project.
3. Create a queue by instantiating the `Queue` struct with the required parameters.
4. Define jobs using the `Define` method.
5. Enqueue jobs using the `Now` method.
6. Start the queue using the `Start` method.

## Examples

### Example 1: Basic Usage

```go
package main

import (
    "fmt"
    "time"
    "github.com/uuuchit/pop-queue/golang"
)

func main() {
    queue := golang.NewQueue("mongodb://localhost:27017", "redis://localhost:6379", "myDatabase", "myCollection", 3)

    queue.Define("myJob", func(job golang.Job) bool {
        fmt.Println("Processing job:", job)
        return true
    })

    queue.Now(golang.Job{Data: "myJobData"}, "myJob", "jobIdentifier", time.Now().Unix())

    queue.Start()
}
```

### Example 2: Handling Failures

```go
package main

import (
    "fmt"
    "time"
    "github.com/uuuchit/pop-queue/golang"
)

func main() {
    queue := golang.NewQueue("mongodb://localhost:27017", "redis://localhost:6379", "myDatabase", "myCollection", 3)

    queue.Define("myJob", func(job golang.Job) bool {
        fmt.Println("Processing job:", job)
        if job.Data == "fail" {
            return false
        }
        return true
    })

    queue.Now(golang.Job{Data: "fail"}, "myJob", "jobIdentifier", time.Now().Unix())

    queue.Start()
}
```

### Example 3: Using Memcached

```go
package main

import (
    "fmt"
    "time"
    "github.com/uuuchit/pop-queue/golang"
)

func main() {
    queue := golang.NewQueue("mongodb://localhost:27017", "memcached://localhost:11211", "myDatabase", "myCollection", 3)

    queue.Define("myJob", func(job golang.Job) bool {
        fmt.Println("Processing job:", job)
        return true
    })

    queue.Now(golang.Job{Data: "myJobData"}, "myJob", "jobIdentifier", time.Now().Unix())

    queue.Start()
}
```

### Example 4: Using PostgreSQL

```go
package main

import (
    "fmt"
    "time"
    "github.com/uuuchit/pop-queue/golang"
)

func main() {
    queue := golang.NewQueue("postgres://localhost:5432", "redis://localhost:6379", "myDatabase", "myCollection", 3)

    queue.Define("myJob", func(job golang.Job) bool {
        fmt.Println("Processing job:", job)
        return true
    })

    queue.Now(golang.Job{Data: "myJobData"}, "myJob", "jobIdentifier", time.Now().Unix())

    queue.Start()
}
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

To register a worker instance, use the `RegisterWorker` method:

```go
queue.RegisterWorker()
```

To deregister a worker instance, use the `DeregisterWorker` method:

```go
queue.DeregisterWorker()
```

### Fault Tolerance

To handle worker failures gracefully and redistribute uncompleted tasks, use the `RedistributeJobs` method:

```go
queue.RedistributeJobs()
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
