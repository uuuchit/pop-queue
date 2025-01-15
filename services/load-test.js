const { PopQueue } = require('../pop-queue/jobManagement');
const config = require('../config/config');

const queue = new PopQueue(config.dbUrl, config.redisUrl, config.dbName, config.collectionName, config.retries);
// Define a job to show processing in console
queue.define('loadTestJob', async (job) => {
    console.log(`Processing job: ${job.identifier}`);
    // Simulate job processing time
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log(`Job processed: ${job.identifier}`);
    return true;
});
async function createAndEnqueueJobs(jobCount, jobName) {
    for (let i = 0; i < jobCount; i++) {
        const jobData = { data: `jobData${i}` };
        const jobIdentifier = `jobIdentifier${i}`;
        const jobScore = Date.now() + i;
        const priority = i % 10; // Assigning priority for edge case testing
        const delay = i % 5 * 1000; // Assigning delay for edge case testing
        await queue.now(jobData, jobName, jobIdentifier, jobScore, priority, delay);
    }
}

async function runEdgeCaseTests() {
    const edgeCaseJobs = [
        { data: 'priorityJob', priority: 10, delay: 0 },
        { data: 'delayedJob', priority: 0, delay: 10000 },
        { data: 'retryJob', priority: 0, delay: 0, retries: 3 },
        { data: 'backoffJob', priority: 0, delay: 0, backoff: { type: 'exponential', delay: 1000 } }
    ];

    for (const job of edgeCaseJobs) {
        const jobName = 'edgeCaseTestJob';
        const jobIdentifier = `edgeCaseJobIdentifier${job.data}`;
        const jobScore = Date.now();
        await queue.now(job, jobName, jobIdentifier, jobScore, job.priority, job.delay);
    }
}

async function startLoadTest() {
    const totalJobs = 1;
    const jobName = 'loadTestJob';

    try {
        console.log('Creating and enqueuing jobs...');
        await createAndEnqueueJobs(totalJobs, jobName);
        console.log('Starting the queue...');
        await queue.start();

        console.log('Running edge case tests...');
        // await runEdgeCaseTests();

        console.log('Load test completed.');
    } catch (error) {
        console.error('Error during load test execution:', error);
    }
}

async function runBatchProcessingTest(batchSize) {
    const jobName = 'batchProcessingTestJob';
    const jobCount = 100000;

    console.log(`Creating and enqueuing ${jobCount} jobs for batch processing test...`);
    await createAndEnqueueJobs(jobCount, jobName);

    console.log(`Running batch processing test with batch size ${batchSize}...`);
    const startTime = Date.now();
    await queue.popBatch(jobName, batchSize);
    const endTime = Date.now();

    console.log(`Batch processing test completed in ${endTime - startTime} ms.`);
}

async function runParallelExecutionTest(parallelJobCount) {
    const jobName = 'parallelExecutionTestJob';
    const jobCount = 100000;

    console.log(`Creating and enqueuing ${jobCount} jobs for parallel execution test...`);
    await createAndEnqueueJobs(jobCount, jobName);

    console.log(`Running parallel execution test with ${parallelJobCount} parallel jobs...`);
    const startTime = Date.now();
    await queue.popBatch(jobName, parallelJobCount);
    const endTime = Date.now();

    console.log(`Parallel execution test completed in ${endTime - startTime} ms.`);
}

async function runRedisPipeliningTest(pipeliningJobCount) {
    const jobName = 'redisPipeliningTestJob';
    const jobCount = 100000;

    console.log(`Creating and enqueuing ${jobCount} jobs for Redis pipelining test...`);
    await createAndEnqueueJobs(jobCount, jobName);

    console.log(`Running Redis pipelining test with ${pipeliningJobCount} jobs...`);
    const startTime = Date.now();
    await queue.pushToBatchQueue(jobName, pipeliningJobCount);
    const endTime = Date.now();

    console.log(`Redis pipelining test completed in ${endTime - startTime} ms.`);
}



startLoadTest();
// runBatchProcessingTest(1000);
// runParallelExecutionTest(1000);
// runRedisPipeliningTest(1000);