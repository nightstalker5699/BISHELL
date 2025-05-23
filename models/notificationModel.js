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
    type: String, 
    required: false
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
    actingUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false
    },
    title: String,
    questionId: mongoose.Schema.Types.ObjectId,
    commentId: mongoose.Schema.Types.ObjectId,
    announcementId: mongoose.Schema.Types.ObjectId,
    courseId: mongoose.Schema.Types.ObjectId,
    courseName: String,
    materialId: mongoose.Schema.Types.ObjectId,
    assignmentId: mongoose.Schema.Types.ObjectId,
    submissionId: mongoose.Schema.Types.ObjectId
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true 
  },
  isRead: { 
    type: Boolean, 
    default: false,
    index: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 30*24*60*60*1000) 
  }
});

notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);