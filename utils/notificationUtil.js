const admin = require('../firebase');
const User = require('../models/userModel');
const Notification = require('../models/notificationModel');
const { NotificationType, formatNotificationMessage } = require('./notificationTypes');

exports.sendNotificationToUser = async (userId, type, data = {}) => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.deviceTokens?.length) {
      console.error('No device tokens found for user:', userId);
      return;
    }

    // Format the notification message using the type and data
    const messageData = formatNotificationMessage(type, data);

    // Create notification in database
    const notification = await Notification.create({
      userId: userId,
      title: messageData.title,
      message: messageData.body,
      type: type,
      link: messageData.click_action,
      metadata: data
    });

    // Convert data fields to string for FCM
    const stringifiedData = {
      notificationId: notification._id.toString(),
      type: type,
      click_action: messageData.click_action,
      ...Object.keys(data).reduce((acc, key) => {
        acc[key] = String(data[key]);
        return acc;
      }, {})
    };

    // Construct the FCM message
    const notificationMessage = {
      data: {
        title: messageData.title,
        body: messageData.body,
        ...stringifiedData
      }
    };

    const batchSize = 500; // Limit for FCM batch processing
    const tokenBatches = [];
    for (let i = 0; i < user.deviceTokens.length; i += batchSize) {
      tokenBatches.push(user.deviceTokens.slice(i, i + batchSize));
    }

    const messaging = admin.messaging();
    const invalidTokens = [];

    // Process each batch of tokens
    for (const batch of tokenBatches) {
      try {
        const messages = batch.map(token => ({
          ...notificationMessage,
          token,
        }));

        // Send messages in batch
        const responses = await Promise.all(
          messages.map(async (msg) => {
            try {
              await messaging.send(msg);
              return { status: 'fulfilled' };
            } catch (error) {
              return { 
                status: 'rejected', 
                error: error 
              };
            }
          })
        );

        // Check for invalid tokens
        responses.forEach((response, index) => {
          if (response.status === 'rejected') {
            const error = response.error;
            if (
              error.code === 'messaging/invalid-registration-token' ||
              error.code === 'messaging/registration-token-not-registered'
            ) {
              invalidTokens.push(batch[index]);
            }
          }
        });
      } catch (error) {
        console.error('Batch send failed:', error);
      }
    }

    // Remove invalid tokens from the database
    if (invalidTokens.length > 0) {
      await User.findByIdAndUpdate(userId, {
        $pull: { deviceTokens: { $in: invalidTokens } },
      });
    }

    return {
      success: true,
      notification,
      message: 'Notifications sent successfully',
      invalidTokensRemoved: invalidTokens.length,
    };
  } catch (error) {
    console.error('Error sending notification:', error);
    return { success: false, message: 'Error sending notification', error };
  }
};