const admin = require('../firebase');
const User = require('../models/userModel');

exports.sendNotificationToUser = async (userId, messageData, data = {}) => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.deviceTokens?.length) {
      console.error('No device tokens found for user:', userId);
      return;
    }

    // Convert data fields to string to meet FCM requirements
    const stringifiedData = Object.keys(data).reduce((acc, key) => {
      acc[key] = String(data[key]);
      return acc;
    }, {});

    // Construct the FCM message
    const notificationMessage = {
      notification: {
        title: messageData.title,
        body: messageData.body,
      },
      data: stringifiedData,
      webpush: {
        headers: {
          Urgency: 'high',
        },
        notification: {
          requireInteraction: true,
        },
        fcm_options: {
          link: stringifiedData.link || '',
        },
      },
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

        // Use Promise.allSettled to handle individual message success/failure
        const responses = await Promise.allSettled(
          messages.map(msg => messaging.send(msg))
        );

        responses.forEach((response, index) => {
          if (response.status === 'rejected') {
            const error = response.reason;
            if (
              error.code?.includes('messaging/invalid-registration-token') ||
              error.code?.includes('messaging/registration-token-not-registered')
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
      message: 'Notifications sent',
      invalidTokensRemoved: invalidTokens.length,
    };
  } catch (error) {
    console.error('Error sending notification:', error);
    return { success: false, message: 'Error sending notification', error };
  }
};
