# Installation

To install the `pop-queue` library, follow these steps:

## Prerequisites

Make sure you have the following software installed on your system:

- Node.js (version 14 or higher)
- npm (Node Package Manager)
- MongoDB
- Redis
- Memcached (optional)
- PostgreSQL (optional)

## Step 1: Clone the Repository

Clone the `pop-queue` repository from GitHub:

```bash
git clone https://github.com/uuuchit/pop-queue.git
cd pop-queue
```

## Step 2: Install Dependencies

Install the required dependencies using npm:

```bash
npm install
```

## Step 3: Configure Environment Variables

Create a `.env` file in the root directory of the project and add the following environment variables:

```env
NODE_ENV=production
DB_URL=mongodb://yourMongoDbUrl:27017
REDIS_URL=redis://yourRedisUrl:6379
MEMCACHED_URL=memcached://yourMemcachedUrl:11211
POSTGRES_URL=postgres://yourPostgresUrl:5432
WORKER_ID=yourWorkerId
WORKER_TIMEOUT=30000
RATE_LIMIT=100
CONCURRENCY=5
BACKOFF_STRATEGY={"type":"exponential","delay":1000}
```

Replace the placeholder values with your actual configuration.

## Step 4: Build the Project

Build the project using npm:

```bash
npm run build
```

## Step 5: Start the Application

Start the application using npm:

```bash
npm start
```

The application should now be running and ready to use.
