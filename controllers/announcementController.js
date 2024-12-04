const catchAsync = require("./../utils/catchAsync");
const appError = require("./../utils/appError");
const factory = require("./handlerFactory");
const Announcement = require("../models/announcementModel");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const APIFeatures = require("../utils/apiFeatures");
const { sendNotificationToUser } = require('../utils/notificationUtil');
const User = require('../models/userModel');

const attach_file = path.join(__dirname, "..", "static/attachFile");
if (!fs.existsSync(attach_file)) {
  fs.mkdirSync(attach_file, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, attach_file);
  },
  filename: (req, file, cb) => {
    file.originalname = (Date.now() + "-" + file.originalname).replace(
      " ",
      "-"
    );
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage,
}).array("attachments");

exports.attachment = upload;
exports.createAnnouncement = catchAsync(async (req, res, next) => {
  const attach = req.files.map((file) => {
    return {
      name: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      path: `/attachFile/${file.originalname}`,
    };
  });
  let groups;
  if (req.body.groups) groups = req.body.groups.split("");
  else groups = ["A", "B", "C", "D"];
  const announcement = await Announcement.create({
    courseId:
      req.params.courseId !== "general" ? req.params.courseId : undefined,
    announcerId: req.user._id,
    title: req.body.title,
    body: req.body.body,
    importance: req.body.importance,
    attach_files: attach,
    groups: groups,
  });

  const filter = { 
    role: { $in: ['student', 'admin', 'instructor'] },
    notificationSettings: { $ne: false } // Only notify users who haven't disabled notifications
  };
  
  if (!announcement.general) {
    filter.group = { $in: announcement.groups };
  }

  // Batch process users
  const batchSize = 1000;
  let lastId = null;
  let failedNotifications = 0;

  while (true) {
    const query = { ...filter };
    if (lastId) {
      query._id = { $gt: lastId };
    }

    const users = await User.find(query)
      .select('_id')
      .limit(batchSize)
      .sort('_id');

    if (users.length === 0) break;

    const notificationPromises = users.map(user => 
      sendNotificationToUser(
        user._id,
        {
          title: announcement.title,
          body: announcement.body.substring(0, 100) + '...'
        },
        {
          type: 'announcement',
          announcementId: announcement._id.toString(),
          importance: announcement.importance.toString(), // Convert to string
          courseId: (announcement.courseId || 'general').toString(),
          groups: announcement.groups.join(','),
          timestamp: Date.now().toString()
        }
      ).catch(err => {
        console.error(`Failed to send notification to user ${user._id}:`, err);
        failedNotifications++;
        return null;
      })
    );

    await Promise.all(notificationPromises);
    lastId = users[users.length - 1]._id;
  }

  res.status(200).json({
    status: "success",
    data: announcement,
  });
});

exports.deleteAnnouncement = catchAsync(async (req, res, next) => {
  const announcement = await Announcement.findById(req.params.announcementId);

  if (!announcement)
    return next(new appError("there is no announcement with that id "), 404);

  if (
    req.user._id.toString() !== announcement.announcerId.toString() &&
    req.user.role !== "admin"
  )
    return next(new appError("you are not the creator of the annouce "), 403);
  for (attach of announcement.attach_files) {
    fs.unlinkSync(path.join(attach_file, attach.name));
  }
  await Announcement.findByIdAndDelete(announcement._id);
  res.status(204).json({ status: "success" });
});

exports.getAllAnnouncement = catchAsync(async (req, res, next) => {
  const filter =
    req.params.courseId !== "general"
      ? { courseId: req.params.courseId }
      : { general: true };
  if (req.query.importance) filter.importance = req.query.importance;

  const page = req.query.page * 1 || 1;
  const limit = 10;
  const skip = (page - 1) * limit;
  const total = await Announcement.countDocuments(filter);

  let query = Announcement.find(filter);
  const features = new APIFeatures(query, req.query);
  features.sort(); 

  const announcements = await features.query
    .skip(skip)
    .limit(limit)
    .select("title importance announcerId")
    .populate({
      path: "announcerId",
      select: "username photo",
    });

  res.status(200).json({
    status: "success",
    data: {
      announcements,
      totalPages: Math.ceil(total / limit),
    },
  });
});

exports.getAnnouncement = catchAsync(async (req, res, next) => {
  const announcement = await Announcement.findById(
    req.params.announcementId
  ).populate({ path: "announcerId", select: "username photo" });

  if (!announcement)
    return next(new appError("there is no announcement with that id "), 404);

  res.status(200).json({ status: "success", data: announcement });
});

exports.updateAnnouncement = catchAsync(async (req, res, next) => {
  const announcement = await Announcement.findById(req.params.announcementId);
  if (!announcement)
    return next(new appError("there is no announcement with that id "), 404);
  if (req.user._id.toString() !== announcement.announcerId.toString())
    return next(new appError("you are not the creator of the annouce "), 403);
  if (req.files[0]) {
    for (file of announcement.attach_files) {
      fs.unlinkSync(path.join(attach_file, file.name));
    }
    const attach = req.files.map((file) => {
      return {
        name: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        path: `/attachFile/${file.originalname}`,
      };
    });
    announcement.attach_files = attach;
  }
  if (req.body.groups)
    announcement.groups = req.body.groups.toUpperCase().split("");
  announcement.body = req.body.body || announcement.body;
  announcement.title = req.body.title || announcement.title;
  await announcement.save();

  res.status(200).json({
    status: "success",
    announcement,
  });
});
