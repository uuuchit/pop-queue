const { PopQueue } = require('./queue');
const config = require('./config');

const queue = new PopQueue(config.dbUrl, config.redisUrl, config.dbName, config.collectionName, config.retries);

async function createAndEnqueueJobs(jobCount) {
    for (let i = 0; i < jobCount; i++) {
        const jobData = { data: `jobData${i}` };
        const jobName = 'loadTestJob';
        const jobIdentifier = `jobIdentifier${i}`;
        const jobScore = Date.now() + i;
        await queue.now(jobData, jobName, jobIdentifier, jobScore);
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

async function startLoadTest() {
    const totalJobs = 1000000;
    const concurrentJobs = 500000;
    const sequentialJobs = 500000;

    console.log('Creating and enqueuing jobs...');
    await createAndEnqueueJobs(totalJobs);

    console.log('Running concurrent tests...');
    await runConcurrentTests(concurrentJobs);

    console.log('Running sequential tests...');
    await runSequentialTests(sequentialJobs);

    console.log('Load test completed.');
}

startLoadTest();
