const fs = require("fs");
const path = require("path");
const catchAsync = require("../utils/catchAsync");
const appError = require("../utils/appError");
const Assigment = require("../models/assigmentModel");
const multer = require("multer");
const sharp = require("sharp");
const Course = require("../models/courseModel");
const uploadDir = path.join(__dirname, "..", "/Assigments");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    file.originalname = (Date.now() + "-" + file.originalname).replace(
      " ",
      "-"
    );
    cb(null, file.originalname);
  },
});
const uploadSystem = multer({
  storage,
});
exports.assigment = uploadSystem.single("file");

exports.createAssigment = catchAsync(async (req, res, next) => {
  let groups;
  if (req.body.groups) groups = req.body.groups.split("");
  else groups = ["A", "B", "C", "D"];
  const courseId = await Course.findOne({ slug: req.params.slug });
  if (req.user._id.toString() !== courseId.instructorId.toString())
    return next(
      new appError("you are not allowed to post an assigment for this course"),
      401
    );
  let assigment;
  try {
    assigment = await Assigment.create({
      instructor: req.user._id,
      course: courseId._id,
      group: groups,
      title: req.body.title,
      content: req.body.content,
      deadline: req.body.deadline,
      file: req.file.filename,
    });
  } catch (err) {
    fs.unlinkSync(path.join(uploadDir, req.file.filename));
    return next(err);
  }

  res.status(200).json({
    status: "success",
    data: { assigment },
  });
});
