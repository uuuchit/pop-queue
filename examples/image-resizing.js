const { PopQueue } = require('../pop-queue/index');
const sharp = require('sharp');
const path = require('path');

const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);

queue.define('imageResizingJob', async (job) => {
  console.log('Processing image resizing job:', job);
  const { inputPath, outputPath, width, height } = job.data;
  await sharp(inputPath)
    .resize(width, height)
    .toFile(outputPath);
  return true;
});

// Define the input and output paths relative to the current script directory
const inputPath = path.join(__dirname, './images/input.png');
const jobs = [
  { outputPath: path.join(__dirname, './images/output1.jpg'), width: 800, height: 600 },
  { outputPath: path.join(__dirname, './images/output2.jpg'), width: 400, height: 300 },
  { outputPath: path.join(__dirname, './images/output3.jpg'), width: 200, height: 150 },
  { outputPath: path.join(__dirname, './images/output4.jpg'), width: 100, height: 75 }
];
queue.start();
// Enqueue the image resizing job
for (const job of jobs) {
  queue.now({ inputPath, ...job }, 'imageResizingJob', `imageResizingJobIdentifier${Date.now()}`, Date.now());
}
// Start the queue
