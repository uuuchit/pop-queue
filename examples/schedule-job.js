const { PopQueue } = require('pop-queue');

const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);

queue.schedule('myScheduledJob', '0 0 * * *', async () => {
  console.log('Executing scheduled job');
  // Perform job logic here
  return true;
});

queue.start();
