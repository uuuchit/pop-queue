const nodemailer = require('nodemailer');
const { EventEmitter } = require('events');

class NotificationService extends EventEmitter {
  constructor(config) {
    super();
    this.transporter = nodemailer.createTransport(config.email);
  }

  async sendEmail(to, subject, text) {
    const mailOptions = {
      from: 'no-reply@example.com',
      to,
      subject,
      text,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.emit('emailSent', { to, subject });
    } catch (error) {
      this.emit('emailError', error);
    }
  }
}

module.exports = NotificationService;
