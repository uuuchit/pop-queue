const { PopQueue } = require('pop-queue');

const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);

queue.define('delayedJob', async (job) => {
  console.log('Processing delayed job:', job);
  // Perform job processing logic here
  return true;
});

queue.now({ data: 'jobData' }, 'delayedJob', 'jobIdentifier', Date.now(), 0, 5000); // Delay 5000ms

queue.start();
