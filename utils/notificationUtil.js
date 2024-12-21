const admin = require('../firebase');
const User = require('../models/userModel');

exports.sendNotificationToUser = async (userId, message) => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.deviceTokens.length) {
      console.error('No device tokens found for user:', userId);
      return;
    }

    const payload = {
      notification: {
        title: message.title,
        body: message.body,
      },
      data: message.data || {},
    };

    const response = await admin.messaging().sendToDevice(user.deviceTokens, payload);
    console.log('Notification sent successfully:', response);
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};