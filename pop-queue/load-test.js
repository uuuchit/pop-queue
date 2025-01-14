const { PopQueue } = require('./queue');
const config = require('./config');

const queue = new PopQueue(config.dbUrl, config.redisUrl, config.dbName, config.collectionName, config.retries);

async function createAndEnqueueJobs(jobCount) {
    for (let i = 0; i < jobCount; i++) {
        const jobData = { data: `jobData${i}` };
        const jobName = 'loadTestJob';
        const jobIdentifier = `jobIdentifier${i}`;
        const jobScore = Date.now() + i;
        const priority = i % 10; // Assigning priority for edge case testing
        const delay = i % 5 * 1000; // Assigning delay for edge case testing
        await queue.now(jobData, jobName, jobIdentifier, jobScore, priority, delay);
    }
}

async function runConcurrentTests(concurrentJobCount) {
    const promises = [];
    for (let i = 0; i < concurrentJobCount; i++) {
        promises.push(queue.pop('loadTestJob'));
    }
    await Promise.all(promises);
}

async function runSequentialTests(sequentialJobCount) {
    for (let i = 0; i < sequentialJobCount; i++) {
        await queue.pop('loadTestJob');
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
    const totalJobs = 1000000;
    const concurrentJobs = 500000;
    const sequentialJobs = 500000;

    try {
        console.log('Creating and enqueuing jobs...');
        await createAndEnqueueJobs(totalJobs);

        console.log('Running concurrent tests...');
        await runConcurrentTests(concurrentJobs);

        console.log('Running sequential tests...');
        await runSequentialTests(sequentialJobs);

        console.log('Running edge case tests...');
        await runEdgeCaseTests();

        console.log('Load test completed.');
    } catch (error) {
        console.error('Error during load test execution:', error);
    }
}

startLoadTest();
