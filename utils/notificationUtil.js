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

    // Construct the FCM message (only data payload to prevent duplicate notifications)
    const notificationMessage = {
      data: {
        title: messageData.title,
        body: messageData.body,
        ...stringifiedData, // Include any custom data passed from the function
      },
    };

    const messaging = admin.messaging();
    const invalidTokens = [];

    // Process tokens in batches
    const batchSize = 500; // Limit for FCM batch processing
    const tokenBatches = Array(Math.ceil(user.deviceTokens.length / batchSize))
      .fill()
      .map((_, i) => user.deviceTokens.slice(i * batchSize, (i + 1) * batchSize));

    for (const batch of tokenBatches) {
      try {
        const responses = await messaging.sendMulticast({
          tokens: batch,
          ...notificationMessage,
        });

        responses.responses.forEach((response, index) => {
          if (!response.success) {
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
      message: 'Notifications sent',
      invalidTokensRemoved: invalidTokens.length,
    };
  } catch (error) {
    console.error('Error sending notification:', error);
    return { success: false, message: 'Error sending notification', error };
  }
};
