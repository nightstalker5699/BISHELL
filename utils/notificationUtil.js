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

    // Construct the FCM message with high priority for background delivery
    const notificationMessage = {
      data: {
        title: messageData.title,
        body: messageData.body,
        icon: messageData.icon || '/default-icon.png',
        ...stringifiedData
      },
      android: {
        priority: 'high'
      },
      apns: {
        headers: {
          'apns-priority': '10'
        }
      },
      webpush: {
        headers: {
          Urgency: 'high'
        }
      }
    };

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
          ...notificationMessage,
          token,
        }));

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