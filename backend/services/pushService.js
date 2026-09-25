const { Expo } = require('expo-server-sdk');

const expo = new Expo();

async function sendCriticalAlertPush({ pushToken, siteName, parameterName, value, unit }) {
    if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
        console.log('Invalid or missing push token, skipping push notification');
        return;
    }

    const message = {
        to: pushToken,
        sound: 'default',
        title: '🚨 Critical Alert',
        body: `${siteName}: ${parameterName} is critical (${value} ${unit})`,
        data: { siteName, parameterName },
        priority: 'high',
    };

    try {
        const receipts = await expo.sendPushNotificationsAsync([message]);
        console.log('Push notification sent:', receipts);
    } catch (err) {
        console.error('Error sending push notification:', err);
    }
}

module.exports = { sendCriticalAlertPush };