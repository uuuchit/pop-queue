const { PopQueue } = require('pop-queue');
const ffmpeg = require('fluent-ffmpeg');

const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);

queue.define('videoTranscodingJob', async (job) => {
  console.log('Processing video transcoding job:', job);
  const { inputPath, outputPath, format } = job.data;
  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(outputPath)
      .format(format)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
  return true;
});

queue.now({ inputPath: 'input.mp4', outputPath: 'output.mp4', format: 'mp4' }, 'videoTranscodingJob', 'videoTranscodingJobIdentifier', Date.now());

queue.start();
