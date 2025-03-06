const Notification = require("../models/notificationModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const APIFeatures = require("../utils/apiFeatures");
const { NotificationConfig } = require("../utils/notificationTypes");

exports.getAllNotifications = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Define notification groups - adding mention to social group
  const notificationGroups = {
    materials: ['new-material'],
    announcements: ['new-announcement', 'course-announcement'],
    comments: ['comment-on-question', 'comment-replied', 'comment-like'],
    questions: ['like-question', 'answer-verified', 'question-following'],
    social: ['new-follower', 'mention']  // Updated to include mentions
  };

  // Base query
  let query = { userId: req.user._id };

  // Add group filter if specified
  if (req.query.group && notificationGroups[req.query.group]) {
    query.type = { $in: notificationGroups[req.query.group] };
  }

  // Add read/unread filter if specified
  if (req.query.isRead !== undefined) {
    query.isRead = req.query.isRead === 'true';
  }

  // Get total counts
  const totalCount = await Notification.countDocuments(query);
  const unreadCount = await Notification.countDocuments({
    ...query,
    isRead: false,
  });

  // Get counts by group
  const groupCounts = await Promise.all(
    Object.entries(notificationGroups).map(async ([group, types]) => {
      const count = await Notification.countDocuments({
        userId: req.user._id,
        type: { $in: types },
        isRead: false
      });
      return { group, count };
    })
  );

  // Build query with population
  let dbQuery = Notification.find(query)
    .populate({
      path: 'metadata.actingUserId',
      select: 'username photo fullName userFrame role',
      model: 'User'
    })
    .skip(skip)
    .limit(limit)
    .sort(req.query.sort || '-createdAt');

  // Execute query
  const notifications = await dbQuery;

  // Transform notifications for response
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const transformedNotifications = notifications.map(notification => {
    const config = NotificationConfig[notification.type];
    
    // Format actingUser data if present
    const actingUser = notification.metadata.actingUserId ? {
      id: notification.metadata.actingUserId._id,
      username: notification.metadata.actingUserId.username,
      fullName: notification.metadata.actingUserId.fullName,
      photo: notification.metadata.actingUserId.photo ? 
        `${baseUrl}/profilePics/${notification.metadata.actingUserId.photo}` : 
        `${baseUrl}/profilePics/default.jpg`,
      userFrame: notification.metadata.actingUserId.userFrame,
      role: notification.metadata.actingUserId.role
    } : null;

    return {
      id: notification._id,
      type: notification.type,
      groupKey: Object.entries(notificationGroups).find(([_, types]) => 
        types.includes(notification.type)
      )?.[0] || 'other',
      title: notification.title,
      message: notification.message,
      link: notification.link,
      isRead: notification.isRead,
      actingUser,
      metadata: {
        ...notification.metadata,
        actingUserId: undefined // Remove raw reference since we have actingUser object
      },
      createdAt: notification.createdAt,
      timeAgo: getTimeAgo(notification.createdAt)
    };
  });

  res.status(200).json({
    status: "success",
    data: {
      notifications: transformedNotifications,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + notifications.length < totalCount,
        total: totalCount,
        limit
      },
      stats: {
        unread: unreadCount,
        byGroup: Object.fromEntries(
          groupCounts.map(({ group, count }) => [group, count])
        )
      }
    }
  });
});

// Helper function for time formatting
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return interval === 1 ? `1 ${unit} ago` : `${interval} ${unit}s ago`;
    }
  }
  return 'Just now';
}

exports.createNotification = catchAsync(async (req, res, next) => {
  if (!req.body.userId || !req.body.title || !req.body.message) {
    return next(new AppError('Please provide userId, title and message', 400));
  }

  const notification = await Notification.create({
    userId: req.body.userId,
    title: req.body.title,
    message: req.body.message,
    type: req.body.type || 'info',
    link: req.body.link,
    metadata: {
      ...req.body.metadata,
      actingUserId: req.user._id // Add the acting user's ID
    }
  });

  res.status(201).json({
    status: 'success',
    data: {
      notification
    }
  });
});

exports.markAllAsRead = catchAsync(async (req, res, next) => {
  // Define notification groups here to match getAllNotifications grouping
  const notificationGroups = {
    materials: ['new-material'],
    announcements: ['new-announcement', 'course-announcement'],
    comments: ['comment-on-question', 'comment-replied', 'comment-like'],
    questions: ['like-question', 'answer-verified', 'question-following'],
    social: ['new-follower', 'mention']
  };

  const filter = { userId: req.user._id, isRead: false };
  
  // Add group filter if specified
  if (req.query.group && notificationGroups[req.query.group]) {
    filter.type = { $in: notificationGroups[req.query.group] };
  }

  const result = await Notification.updateMany(filter, { isRead: true });

  // Get updated unread counts
  const groupCounts = await Promise.all(
    Object.entries(notificationGroups).map(async ([group, types]) => {
      const count = await Notification.countDocuments({
        userId: req.user._id,
        type: { $in: types },
        isRead: false
      });
      return { group, count };
    })
  );

  const unreadCount = await Notification.countDocuments({
    userId: req.user._id,
    isRead: false
  });

  res.status(200).json({
    status: "success",
    message: `${result.modifiedCount} notifications marked as read`,
    data: {
      stats: {
        unread: unreadCount,
        byGroup: Object.fromEntries(
          groupCounts.map(({ group, count }) => [group, count])
        )
      }
    }
  });
});

exports.getUnreadCount = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  // Define notification groups consistent with getAllNotifications
  const notificationGroups = {
    materials: ['new-material'],
    announcements: ['new-announcement', 'course-announcement'],
    comments: ['comment-on-question', 'comment-replied', 'comment-like'],
    questions: ['like-question', 'answer-verified', 'question-following'],
    social: ['new-follower','mention']
  };

  // Get total unread count
  const totalUnread = await Notification.countDocuments({
    userId,
    isRead: false
  });

  // Get counts by group
  const groupCounts = await Promise.all(
    Object.entries(notificationGroups).map(async ([group, types]) => {
      const count = await Notification.countDocuments({
        userId,
        type: { $in: types },
        isRead: false
      });
      return [group, count];
    })
  );

  // Get individual type counts
  const typeCounts = await Notification.aggregate([
    {
      $match: {
        userId: userId,
        isRead: false
      }
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 }
      }
    }
  ]);

  // Convert type counts array to object
  const byType = Object.fromEntries(
    typeCounts.map(({ _id, count }) => [_id, count])
  );

  res.status(200).json({
    status: "success",
    data: {
      total: totalUnread,
      groups: Object.fromEntries(groupCounts),
      byType
    }
  });
});

exports.markAsRead = catchAsync(async (req, res, next) => {
  const notification = await Notification.findOneAndUpdate(
    {
      _id: req.params.id,
      userId: req.user._id,
    },
    { isRead: true }
  );

  if (!notification) {
    return next(new AppError("Notification not found", 404));
  }

  res.status(204).json();
});

exports.deleteNotification = catchAsync(async (req, res, next) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!notification) {
    return next(new AppError("Notification not found", 404));
  }

  await notification.remove();

  res.status(204).json({
    status: "success",
    data: null,
  });
});

exports.deleteAllByGroup = catchAsync(async (req, res, next) => {
  const { group } = req.query;
  
  // Define notification groups
  const notificationGroups = {
    materials: ['new-material'],
    announcements: ['new-announcement', 'course-announcement'],
    comments: ['comment-on-question', 'comment-replied', 'comment-like'],
    questions: ['like-question', 'answer-verified', 'question-following'],
    social: ['new-follower','mention']
  };

  // Validate group parameter
  if (!group || !notificationGroups[group]) {
    return next(new AppError('Please provide a valid notification group', 400));
  }

  // Delete notifications for the specified group
  const result = await Notification.deleteMany({
    userId: req.user._id,
    type: { $in: notificationGroups[group] }
  });

  // Get updated counts for remaining notifications
  const groupCounts = await Promise.all(
    Object.entries(notificationGroups).map(async ([groupName, types]) => {
      const count = await Notification.countDocuments({
        userId: req.user._id,
        type: { $in: types }
      });
      return { group: groupName, count };
    })
  );

  res.status(200).json({
    status: 'success',
    message: `${result.deletedCount} notifications deleted from ${group} group`,
    data: {
      deletedCount: result.deletedCount,
      remainingCounts: Object.fromEntries(
        groupCounts.map(({ group, count }) => [group, count])
      )
    }
  });
});