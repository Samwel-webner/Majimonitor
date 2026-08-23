const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
    }
});

async function sendAlertEmail({ siteName, parameterName, value, unit, severity }) {
    try {
        await transporter.sendMail({
            from: process.env.ALERT_EMAIL_FROM,
            to: process.env.ALERT_EMAIL_TO,
            subject: `🚨 MajiMonitor Alert: ${severity.toUpperCase()} - ${siteName}`,
            text: `A ${severity} reading was detected.\n\nSite: ${siteName}\nParameter: ${parameterName}\nValue: ${value} ${unit}\n\nPlease check the MajiMonitor dashboard for details.`
        });
        console.log(`📧 Alert email sent for ${siteName} - ${parameterName}`);
    } catch (err) {
        console.error('Failed to send alert email:', err.message);
    }
}

async function sendPasswordResetEmail({ toEmail, name, token }) {
    const resetLink = `http://127.0.0.1:5500/frontend/reset-password.html?token=${token}`;
    try {
        await transporter.sendMail({
            from: process.env.ALERT_EMAIL_FROM,
            to: toEmail,
            subject: 'MajiMonitor Password Reset',
            text: `Hi ${name},\n\nYou requested a password reset. Click the link below (valid for 30 minutes):\n\n${resetLink}\n\nIf you didn't request this, you can ignore this email.`
        });
        console.log(`📧 Password reset email sent to ${toEmail}`);
    } catch (err) {
        console.error('Failed to send password reset email:', err.message);
    }
}

module.exports = { sendAlertEmail, sendPasswordResetEmail };