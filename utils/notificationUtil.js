const admin = require('../firebase');
const User = require('../models/userModel');
const Notification = require('../models/notificationModel');
const { NotificationType, formatNotificationMessage } = require('./notificationTypes');

// Create in-app notification only
const createInAppNotification = async (userId, type, data = {}) => {
  const messageData = formatNotificationMessage(type, data);
  
  return await Notification.create({
    userId: userId,
    title: messageData.title,
    message: messageData.body,
    type: type,
    link: messageData.click_action,
    metadata: data
  });
};

// Send FCM push notification only
const sendPushNotification = async (user, messageData, notificationId, type, data) => {
  if (!user.deviceTokens?.length) return null;

  const stringifiedData = {
    notificationId: notificationId.toString(),
    type: type,
    click_action: messageData.click_action,
    ...Object.keys(data).reduce((acc, key) => {
      acc[key] = String(data[key]);
      return acc;
    }, {})
  };

  const notificationMessage = {
    data: {
      title: messageData.title,
      body: messageData.body,
      ...stringifiedData
    }
  };

  const batchSize = 500;
  const tokenBatches = [];
  for (let i = 0; i < user.deviceTokens.length; i += batchSize) {
    tokenBatches.push(user.deviceTokens.slice(i, i + batchSize));
  }

  const messaging = admin.messaging();
  const invalidTokens = [];

  // Process batches
  for (const batch of tokenBatches) {
    try {
      const messages = batch.map(token => ({
        ...notificationMessage,
        token,
      }));

      const responses = await Promise.all(
        messages.map(async (msg) => {
          try {
            await messaging.send(msg);
            return { status: 'fulfilled' };
          } catch (error) {
            return { status: 'rejected', error };
          }
        })
      );

      responses.forEach((response, index) => {
        if (response.status === 'rejected' && 
            (response.error.code === 'messaging/invalid-registration-token' ||
             response.error.code === 'messaging/registration-token-not-registered')) {
          invalidTokens.push(batch[index]);
        }
      });
    } catch (error) {
      console.error('Batch send failed:', error);
    }
  }

  // Remove invalid tokens
  if (invalidTokens.length > 0) {
    await User.findByIdAndUpdate(user._id, {
      $pull: { deviceTokens: { $in: invalidTokens } },
    });
  }

  return invalidTokens.length;
};

// Main notification function
exports.sendNotificationToUser = async (userId, type, data = {}) => {
  try {
    // Always create in-app notification
    const notification = await createInAppNotification(userId, type, data);
    
    // Only attempt push notification if user exists
    const user = await User.findById(userId);
    if (!user) {
      return {
        success: true,
        notification,
        message: 'In-app notification created, user not found for push',
      };
    }

    // Format message once for both notifications
    const messageData = formatNotificationMessage(type, data);
    
    // Attempt push notification if user has tokens
    const invalidTokensRemoved = await sendPushNotification(
      user, 
      messageData, 
      notification._id, 
      type, 
      data
    );

    return {
      success: true,
      notification,
      message: 'Notifications processed successfully',
      invalidTokensRemoved: invalidTokensRemoved || 0,
    };

  } catch (error) {
    console.error('Error processing notification:', error);
    return { 
      success: false, 
      message: 'Error processing notification', 
      error 
    };
  }
};