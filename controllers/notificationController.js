const Notification = require("../models/notificationModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

exports.getAllNotifications = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Get total counts
  const totalCount = await Notification.countDocuments({
    userId: req.user._id,
  });
  const unreadCount = await Notification.countDocuments({
    userId: req.user._id,
    isRead: false,
  });

  // Get paginated notifications
  const notifications = await Notification.find({ userId: req.user._id })
    .sort("-createdAt")
    .skip(skip)
    .limit(limit)
    .populate("userId", "username photo");

  res.status(200).json({
    status: "success",
    results: notifications.length,
    data: {
      notifications,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalNotifications: totalCount,
        unreadCount,
      },
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
    metadata: req.body.metadata
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

// Add a new endpoint to get unread count
exports.getUnreadCount = catchAsync(async (req, res, next) => {
  const count = await Notification.countDocuments({
    userId: req.user._id,
    isRead: false,
  });

  res.status(200).json({
    status: "success",
    data: { unreadCount: count },
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
