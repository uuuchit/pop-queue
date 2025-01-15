const { scheduleJob } = require('node-schedule');
const { Job } = require('./job');
const { JobQueue } = require('./job-queue');

class JobScheduler {
  constructor() {
    this.jobQueue = new JobQueue();
  }

  schedule(jobName, cronExpression, jobFunction) {
    const job = new Job(jobName, cronExpression, jobFunction);
    this.jobQueue.addJob(job);
    scheduleJob(cronExpression, jobFunction);
  }

  start() {
    this.jobQueue.getJobs().forEach(job => {
      scheduleJob(job.cronExpression, job.jobFunction);
    });
  }

  stop() {
    this.jobQueue.getJobs().forEach(job => {
      job.cancel();
    });
  }
}

module.exports = JobScheduler;
