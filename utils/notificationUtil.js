const User = require('../models/userModel');
const admin = require('../firebase');

exports.sendNotificationToUser = async (userId, notification, data = {}) => {
  try {
    const user = await User.findById(userId);
    if (!user?.deviceTokens?.length) {
      return { success: false, message: 'No valid tokens found' };
    }

    const stringifiedData = Object.keys(data).reduce((acc, key) => {
      acc[key] = String(data[key]);
      return acc;
    }, {});

    // Simplified message structure
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
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
          link: stringifiedData.link || ''
        }
      }
    };

    // Keep token batching and cleanup logic
    const batchSize = 500;
    const tokenBatches = [];
    for (let i = 0; i < user.deviceTokens.length; i += batchSize) {
      tokenBatches.push(user.deviceTokens.slice(i, i + batchSize));
    }

    const messaging = admin.messaging();
    const invalidTokens = [];
    
    for (const batch of tokenBatches) {
      try {
        const messages = batch.map(token => ({
          ...message,
          token
        }));

        const responses = await Promise.allSettled(
          messages.map(msg => messaging.send(msg))
        );

        responses.forEach((response, index) => {
          if (response.status === 'rejected') {
            const error = response.reason;
            if (error.code?.includes('messaging/invalid-registration-token') ||
                error.code?.includes('messaging/registration-token-not-registered')) {
              invalidTokens.push(batch[index]);
            }
          }
        });
      } catch (error) {
        console.error('Batch send failed:', error);
      }
    }

    if (invalidTokens.length > 0) {
      await User.findByIdAndUpdate(userId, {
        $pull: { deviceTokens: { $in: invalidTokens } }
      });
    }

    return {
      success: true,
      message: 'Notifications sent',
      invalidTokensRemoved: invalidTokens.length
    };

  } catch (error) {
    console.error('Notification error:', error);
    return { success: false, message: error.message };
  }
};