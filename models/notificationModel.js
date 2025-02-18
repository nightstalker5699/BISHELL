const mongoose = require('mongoose');
const { NotificationType, formatNotificationMessage } = require('../utils/notificationTypes');

const notificationSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: Object.values(NotificationType),
    default: NotificationType.INFO
  },
  link: {
    type: String, // URL where clicking the notification should redirect
    required: false
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed, // Additional data specific to notification type
    required: false
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true // Add index for better query performance
  },
  isRead: { 
    type: Boolean, 
    default: false,
    index: true // Add index for better query performance
  },
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 30*24*60*60*1000) // Expire after 30 days
  }
});

// Add TTL index to automatically delete old notifications
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Add compound index for efficient queries
notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);