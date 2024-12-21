const User = require('../models/userModel');
const admin = require('../firebase');

exports.cleanupInvalidTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user?.deviceTokens?.length) return;

    const messaging = admin.messaging();
    const invalidTokens = [];

    // Test each token
    const tokenTests = await Promise.allSettled(
      user.deviceTokens.map(async token => {
        try {
          await messaging.send({ token }, true); // dry run
          return { token, valid: true };
        } catch (error) {
          if (error.code?.includes('messaging/invalid-registration') || 
              error.code?.includes('messaging/registration-token-not-registered')) {
            return { token, valid: false };
          }
          return { token, valid: true }; // assume valid on other errors
        }
      })
    );

    tokenTests.forEach(result => {
      if (result.status === 'fulfilled' && !result.value.valid) {
        invalidTokens.push(result.value.token);
      }
    });

    if (invalidTokens.length > 0) {
      await User.findByIdAndUpdate(userId, {
        $pull: { deviceTokens: { $in: invalidTokens } }
      });
      console.log(`Cleaned up ${invalidTokens.length} invalid tokens for user ${userId}`);
    }
  } catch (error) {
    console.error('Token cleanup error:', error);
  }
};

const getNotificationConfig = (type, data) => {
  const baseUrl = 'http://localhost:5173';
  
  const configs = {
    announcement: {
      icon: `${baseUrl}/icons/announcement.png`,
      link: `${baseUrl}/announcements/${data.announcementId}`,
      badge: `${baseUrl}/icons/badge.png`
    },
    question: {
      icon: `${baseUrl}/icons/question.png`,
      link: `${baseUrl}/questions/${data.questionId}`,
      badge: `${baseUrl}/icons/badge.png`
    },
    default: {
      icon: `${baseUrl}/icons/default.png`,
      link: baseUrl,
      badge: `${baseUrl}/icons/badge.png`
    }
  };

  return configs[type] || configs.default;
};

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

    const notificationConfig = getNotificationConfig(data.type, stringifiedData);

    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        icon: notificationConfig.icon,
      },
      data: {
        ...stringifiedData,
        origin: 'server_push',
        notificationId: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        clickAction: notificationConfig.link
      },
      webpush: {
        headers: {
          Urgency: 'high'
        },
        notification: {
          requireInteraction: true,
          tag: `server_${Date.now()}`,
          renotify: false,
          icon: notificationConfig.icon,
          badge: notificationConfig.badge,
          actions: [
            {
              action: 'view',
              title: 'View',
              icon: `${baseUrl}/icons/view.png`
            }
          ],
          data: {
            url: notificationConfig.link
          }
        },
        fcm_options: {
          link: notificationConfig.link
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