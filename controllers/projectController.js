const catchAsync = require("./../utils/catchAsync");
const appError = require("./../utils/appError");
const factory = require("./handlerFactory");
const Project = require("../models/projectModel");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const APIFeatures = require("../utils/apiFeatures");
const { sendNotificationToUser } = require("../utils/notificationUtil");
const User = require("../models/userModel");
const Course = require("../models/courseModel");
const { NotificationType } = require("../utils/notificationTypes");
const moment = require("moment");
const { fileUploader } = require("../utils/fileUploader");
// create the files path in local storage
const attach_file = path.join(
  __dirname,
  "..",
  "static",
  "project",
  "attach_file"
);

// check if the folder is there or not and create it if not

exports.attachment = fileUploader(attach_file, "attach_file", true);

// check if course exist and if the instructor is the course instructor
exports.courseInstructor = catchAsync(async (req, res, next) => {
  const course = await Course.findById(req.params.courseId);
  if (!course)
    return next(new appError("there is no course with that id", 404));
  if (["admin", "group-leader"].includes(req.user.role)) {
    req.course = course;
    return next();
  }
  if (course.instructorId != req.user._id)
    return next(new appError("You are not the instructor of this course", 400));

  req.course = course;
  next();
});

exports.create = catchAsync(async (req, res, next) => {
  const query = { ...req.body };
  if (req.file) {
    query.attach_file = {
      name: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      path: `/project/attach_file/${req.file.originalname}`,
    };
  }
  query.courseId = req.params.courseId;
  // convert the date to utc timezone
  query.dueDate = moment.utc(query.dueDate).toDate();
  const project = await Project.create(query);
  res.status(200).json({
    message: "success",
    data: project,
  });

  const usersToNotify = await User.find({
    role: { $in: ["student", "group-leader", "admin"] },
  });

  const notifpromises = usersToNotify.map((user) => {
    const notifData = {
      title: project.name,
      projectId: project._id,
      actinguserId: req.user._id,
      courseId: req.course._id,
      courseName: req.course.courseName,
    };

    return sendNotificationToUser(
      user._id,
      NotificationType.NEW_PROJECT,
      notifData
    );
  });

  Promise.all(notifpromises).catch((err) => {
    console.error("Error sending Notication:", err);
  });
});

exports.getAllProject = catchAsync(async (req, res, next) => {
  const course = await Course.findById(req.params.courseId);
  if (!course)
    return next(new appError("there is no course with that id ", 404));

  const projects = await Project.find({
    courseId: course._id,
  });

  res.status(200).json({
    message: "success",
    data: {
      projects,
      // course,
    },
  });
});
