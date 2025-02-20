const Notification = require("../models/notificationModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const APIFeatures = require("../utils/apiFeatures");

exports.getAllNotifications = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Define notification groups
  const notificationGroups = {
    materials: ['new-material'],
    announcements: ['new-announcement', 'course-announcement'],
    comments: ['comment-on-question', 'comment-replied'],
    likes: ['like-question', 'comment-like'],
    followers: ['new-follower']
  };

  // Base query
  let query = { userId: req.user._id };

  // Add group filter if specified
  if (req.query.group && notificationGroups[req.query.group]) {
    query.type = { $in: notificationGroups[req.query.group] };
  }

  // Get total counts based on filters
  const totalCount = await Notification.countDocuments(query);
  const unreadCount = await Notification.countDocuments({
    ...query,
    isRead: false,
  });

  // Modify query to use direct MongoDB methods instead of APIFeatures
  let dbQuery = Notification.find(query)
    .populate("userId", "username photo") // notification owner
    .populate({
      path: 'metadata.actingUserId',
      select: 'username photo',
      model: 'User'
    })
    .skip(skip)
    .limit(limit)
    .sort('-createdAt');
  // Execute query
  const notifications = await dbQuery;
  
  const transformedNotifications = notifications.map(notification => {
    const transformed = {
      id: notification._id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      link: notification.link,
      metadata: {
        ...notification.metadata,
        actingUser: notification.metadata.actingUserId ? {
          id: notification.metadata.actingUserId._id,
          username: notification.metadata.actingUserId.username,
          photo: notification.metadata.actingUserId.photo
        } : null
      },
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      user: {
        id: notification.userId._id,
        username: notification.userId.username,
        photo: notification.userId.photo
      }
    };
    delete transformed.metadata.actingUserId; // Remove the raw reference
    return transformed;
  });

  res.status(200).json({
    status: "success",
    results: notifications.length,
    data: {
      notifications: transformedNotifications,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalNotifications: totalCount,
        unreadCount,
      }
    },
  });
});

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

// Add a new endpoint to mark all as read
exports.markAllAsRead = catchAsync(async (req, res, next) => {
  await Notification.updateMany(
    { userId: req.user._id, isRead: false },
    { isRead: true }
  );

  res.status(200).json({
    status: "success",
    message: "All notifications marked as read",
  });
});


exports.getUnreadCount = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  // Define the notification type groups
  const typeGroups = {
    materials: ['new-material'],
    announcements: ['new-announcement', 'course-announcement'],
    comments: ['comment-on-question', 'comment-replied'],
    likes: ['like-question', 'comment-like'],
    followers: ['new-follower']
  };

  // Get all notifications grouped by type
  const typeCountsArray = await Notification.aggregate([
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

  // Convert array to object
  const typeCount = typeCountsArray.reduce((acc, { _id, count }) => {
    acc[_id] = count;
    return acc;
  }, {});

  // Calculate grouped counts
  const groupedCounts = {
    materials: typeGroups.materials.reduce((sum, type) => sum + (typeCount[type] || 0), 0),
    announcements: typeGroups.announcements.reduce((sum, type) => sum + (typeCount[type] || 0), 0),
    comments: typeGroups.comments.reduce((sum, type) => sum + (typeCount[type] || 0), 0),
    likes: typeGroups.likes.reduce((sum, type) => sum + (typeCount[type] || 0), 0),
    followers: typeGroups.followers.reduce((sum, type) => sum + (typeCount[type] || 0), 0)
  };

  // Calculate total unread
  const totalUnread = Object.values(groupedCounts).reduce((sum, count) => sum + count, 0);

  res.status(200).json({
    status: "success",
    data: {
      total: totalUnread,
      groups: groupedCounts,
      byType: typeCount // Keep individual type counts for reference if needed
    }
  });
});

exports.markAsRead = catchAsync(async (req, res, next) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!notification) {
    return next(new AppError("Notification not found", 404));
  }

  notification.isRead = true;
  await notification.save();

  res.status(200).json({
    status: "success",
    data: { notification },
  });
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
