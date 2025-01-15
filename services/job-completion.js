const { updateJobStatus, removeJobFromQueue } = require('../utils/helpers');

async function completeJob(job) {
  try {
    // Update job status to 'completed'
    await updateJobStatus(job.id, 'completed');

    // Remove job from the queue
    await removeJobFromQueue(job.id);

    console.log(`Job ${job.id} completed successfully.`);
  } catch (error) {
    console.error(`Failed to complete job ${job.id}:`, error);
  }
}

module.exports = {
  completeJob,
};
