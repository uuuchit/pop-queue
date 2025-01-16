const { PopQueue } = require('../pop-queue/index');
const config = require('../config/config');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { WebClient } = require('@slack/web-api');
const axios = require('axios');
const winston = require('winston');

// Initialize the queue
const queue = new PopQueue(config.dbUrl, config.redisUrl, config.dbName, config.collectionName, config.retries);
queue.connect();

// Configure logging
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

// Define a job to show processing in console
queue.define('exampleJob', async (job) => {
    console.log(`Processing job: ${job.identifier}`);
    // Simulate job processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`Job processed: ${job.identifier}`);
    return true;
});

// API-specific functions

async function sendEmail(smtpConfig, from, to, subject, text) {
    try {
        let transporter = nodemailer.createTransport(smtpConfig);
        await transporter.sendMail({
            from,
            to,
            subject,
            text
        });
        logger.info(`Email sent to ${to}`);
    } catch (error) {
        logger.error('Error sending email:', error);
    }
}

async function sendSlackMessage(token, channel, text) {
    try {
        const slackClient = new WebClient(token);
        await slackClient.chat.postMessage({
            channel,
            text
        });
        logger.info(`Slack message sent to channel ${channel}`);
    } catch (error) {
        logger.error('Error sending Slack message:', error);
    }
}

async function sendWebhookNotification(url, event, data) {
    try {
        await axios.post(url, {
            event,
            data
        });
        logger.info(`Webhook notification sent to ${url}`);
    } catch (error) {
        logger.error('Error sending webhook notification:', error);
    }
}

async function notifySystems(notificationConfig, event, data) {
    if (notificationConfig.webhook) {
        await sendWebhookNotification(notificationConfig.webhook.url, event, data);
    }

    if (notificationConfig.email) {
        await sendEmail(notificationConfig.email.smtpConfig, notificationConfig.email.from, notificationConfig.email.to, `Notification: ${event}`, JSON.stringify(data, null, 2));
    }

    if (notificationConfig.slack) {
        await sendSlackMessage(notificationConfig.slack.token, notificationConfig.slack.channel, `Notification: ${event}\n${JSON.stringify(data, null, 2)}`);
    }
}

async function scheduleRecurringJob(name, cronExpression, jobData, identifier, priority = 0) {
    cron.schedule(cronExpression, async () => {
        await queue.now(jobData, name, identifier, Date.now(), priority);
    });
}

// Functions to be used in UI

async function getPaginatedExecutedQueue(name, { lastNDays = 1, skip, limit, sort, search, status }) {
    try {
        let startOfNDay = new Date(Date.now() - lastNDays * 24 * 60 * 60 * 1000);
        startOfNDay.setUTCHours(0,0,0,0);
        let oId = objectId.createFromTime(startOfNDay.getTime() / 1000);
        let filter = {
            _id: {
                $gte: oId.toString(),
            },
            name
        };

        if (status === "failed") {
            filter.status = status
        }
        let docs = await queue.db.collection(queue.getDbCollectionName(name)).find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .toArray();
        return docs;
    } catch (e) {
        console.log(e);
        logger.error('Error getting paginated executed queue:', e);
    }
}

async function getCurrentQueue(name) {
    try {
        let docs =  await queue.redisClient.zrange(`pop:queue:${name}`, 0 , - 1);
        docs = docs.filter(d => d).map(d => parseDocFromRedis(d));
        return docs;
    } catch (e) {
        console.log(e);
        logger.error('Error getting current queue:', e);
    }
}

async function getAllJobsPaginated({ skip, limit, sort, search, status }) {
    try {
        let filter = {};

        if (status) {
            filter.status = status;
        }

        let docs = await queue.db.collection(queue.cName).find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .toArray();
        return docs;
    } catch (e) {
        console.log(e);
        logger.error('Error getting all jobs paginated:', e);
    }
}

module.exports = {
    queue,
    sendEmail,
    sendSlackMessage,
    sendWebhookNotification,
    notifySystems,
    scheduleRecurringJob,
    getPaginatedExecutedQueue,
    getCurrentQueue,
    getAllJobsPaginated
};