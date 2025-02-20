const catchAsync = require("./../utils/catchAsync");
const appError = require("./../utils/appError");
const factory = require("./handlerFactory");
const Announcement = require("../models/announcementModel");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const APIFeatures = require("../utils/apiFeatures");
const { sendNotificationToUser } = require("../utils/notificationUtil");
const User = require("../models/userModel");
const Course = require("../models/courseModel");
const { NotificationType } = require('../utils/notificationTypes');


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

  let course;
  if (req.params.courseId !== "general") {
    course = await Course.findById(req.params.courseId);
    if (!course) {
      return next(new appError("Course not found", 404));
    }
  }
  
  const announcement = await Announcement.create({
    courseId: course ? course._id : undefined,
    announcerId: req.user._id,
    title: req.body.title,
    body: req.body.body,
    importance: req.body.importance,
    attach_files: attach,
    groups: groups,
  });

  res.status(200).json({
    status: "success",
    data: announcement,
  });

  // Handle notifications in background after response
  const usersToNotify = await User.find({ group: { $in: groups } });

  // Determine notification type and data based on announcement type
  const notificationType = course
    ? NotificationType.NEW_COURSE_ANNOUNCEMENT
    : NotificationType.NEW_ANNOUNCEMENT;

  const notificationPromises = usersToNotify.map((user) => {
    const notificationData = {
      title: announcement.title,
      announcementId: announcement._id,
      actingUserId: req.user._id // Add acting user for population
    };

    // Add course data if it's a course announcement
    if (course) {
      notificationData.courseId = course._id;
      notificationData.courseName = course.name;
    }

    return sendNotificationToUser(
      user._id,
      notificationType,
      notificationData
    );
  });

  // Process notifications in background
  Promise.all(notificationPromises).catch((err) => {
    console.error("Error sending notifications:", err);
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
