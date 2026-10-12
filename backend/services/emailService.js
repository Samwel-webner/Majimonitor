const nodemailer = require('nodemailer');

// Render's free tier blocks the SMTP ports, so on Render the email goes through the Resend
// HTTPS API. When RESEND_API_KEY is not set (for example on the laptop), the SMTP settings are used.
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
    }
});

// Where the web pages live. The default is the local Live Server; on Render, set FRONTEND_URL
// to https://majimonitor-frontend.onrender.com
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:5500/frontend';

// Sends one plain-text email by whichever route is configured
async function deliver({ to, subject, text }) {
    if (process.env.RESEND_API_KEY) {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: process.env.ALERT_EMAIL_FROM,
                to: [to],
                subject,
                text
            })
        });
        if (!res.ok) {
            throw new Error(`Resend answered ${res.status}: ${await res.text()}`);
        }
        return;
    }

    await transporter.sendMail({
        from: process.env.ALERT_EMAIL_FROM,
        to,
        subject,
        text
    });
}

async function sendAlertEmail({ siteName, parameterName, value, unit, severity }) {
    try {
        await deliver({
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
    const resetLink = `${FRONTEND_URL}/reset-password.html?token=${token}`;
    try {
        await deliver({
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