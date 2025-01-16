const { PopQueue } = require('pop-queue');
const nodemailer = require('nodemailer');

const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-email-password'
  }
});

queue.define('bulkEmailJob', async (job) => {
  console.log('Processing bulk email job:', job);
  const { to, subject, text } = job.data;
  await transporter.sendMail({
    from: 'your-email@gmail.com',
    to,
    subject,
    text
  });
  return true;
});

queue.now({ to: 'user@example.com', subject: 'Hello', text: 'This is a bulk email.' }, 'bulkEmailJob', 'bulkEmailJobIdentifier', Date.now());

queue.start();
