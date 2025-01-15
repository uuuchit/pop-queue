const nodemailer = require('nodemailer');
const { WebClient } = require('@slack/web-api');
const axios = require('axios');
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

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

module.exports = {
    sendEmail,
    sendSlackMessage,
    sendWebhookNotification,
    notifySystems
};