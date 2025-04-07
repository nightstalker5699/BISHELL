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

// create the files path in local storage
const attach_file = path.join(
  __dirname,
  "..",
  "static",
  "project",
  "attach_file"
);

// check if the folder is there or not and create it if not
if (!fs.existsSync(attach_file)) {
  fs.mkdirSync(attach_file, { recursive: true });
}

// create a multer storage object that include destination which is file location and their filename
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
}).single("attach_file");

exports.attachment = upload;

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
