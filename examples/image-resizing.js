const { PopQueue } = require('pop-queue');
const sharp = require('sharp');

const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);

queue.define('imageResizingJob', async (job) => {
  console.log('Processing image resizing job:', job);
  const { inputPath, outputPath, width, height } = job.data;
  await sharp(inputPath)
    .resize(width, height)
    .toFile(outputPath);
  return true;
});

queue.now({ inputPath: 'input.jpg', outputPath: 'output.jpg', width: 800, height: 600 }, 'imageResizingJob', 'imageResizingJobIdentifier', Date.now());

queue.start();
