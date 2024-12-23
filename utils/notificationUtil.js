const admin = require('../firebase');
const User = require('../models/userModel');

exports.sendNotificationToUser = async (userId, messageData, data = {}) => {
  try {
    const user = await User.findById(userId);
    console.log('Retrieved User:', user); // Log the retrieved user

    if (!user || !user.deviceTokens?.length) {
      console.error('No device tokens found for user:', userId);
      return { success: false, message: 'No device tokens found' };
    }

    console.log('Device Tokens:', user.deviceTokens); // Log device tokens

    // Convert data fields to string to meet FCM requirements
    const stringifiedData = Object.keys(data).reduce((acc, key) => {
      acc[key] = String(data[key]);
      return acc;
    }, {});

    // Construct the FCM message
    const notificationMessage = {
      data: {
        title: messageData.title,
        body: messageData.body,
        ...stringifiedData  // Include the stringified data
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
      console.log(`Removed ${invalidTokens.length} invalid tokens for user ${userId}`);
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