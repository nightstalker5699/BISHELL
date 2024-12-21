const User = require('../models/userModel');
const admin = require('../firebase');

/**
 * Sends a notification to a single user.
 * @param {String} userId - The ID of the user to notify.
 * @param {Object} notification - The notification content (title and body).
 * @param {Object} [data={}] - Additional data to send with the notification.
 * @returns {Object} Result of the notification send operation.
 */
exports.sendNotificationToUser = async (userId, notification, data = {}) => {
  try {
    const user = await User.findById(userId);
    if (!user?.deviceTokens?.length) {
      console.error('No device tokens found for user:', userId);
      return { success: false, message: 'No valid tokens found' };
    }

    const payload = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: {
        ...Object.fromEntries(
          Object.entries(data).map(([key, value]) => [key, String(value)])
        ),
        origin: 'server_push',
        notificationId: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      },
    };

    const messaging = admin.messaging();
    console.log('Messaging instance:', messaging); // Debug log

    const response = await messaging.sendToDevice(user.deviceTokens, payload);
    console.log('Notification sent successfully:', response);

    // Handle invalid tokens
    const invalidTokens = [];
    response.results.forEach((result, index) => {
      if (result.error) {
        const error = result.error;
        if (
          error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered'
        ) {
          invalidTokens.push(user.deviceTokens[index]);
        }
      }
    });

    if (invalidTokens.length > 0) {
      await User.findByIdAndUpdate(userId, {
        $pull: { deviceTokens: { $in: invalidTokens } },
      });
      console.log(`Removed ${invalidTokens.length} invalid tokens for user: ${userId}`);
    }

    return {
      success: true,
      message: 'Notifications sent',
      invalidTokensRemoved: invalidTokens.length,
    };
  } catch (error) {
    console.error('Notification error:', error);
    return { success: false, message: error.message };
  }
};