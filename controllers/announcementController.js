const catchAsync = require("./../utils/catchAsync");
const appError = require("./../utils/appError");
const factory = require("./handlerFactory");
const Announcement = require("../models/announcementModel");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const attach_file = path.join(__dirname, "..", "static/attachFile");
if (!fs.existsSync(attach_file)) {
  fs.mkdirSync(attach_file, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, attach_file);
  },
  filename: (req, file, cb) => {
    file.originalname = Date.now() + "-" + file.originalname;
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

  const announcement = await Announcement.create({
    courseId: req.params.courseId,
    announcerId: req.user._id,
    title: req.body.title,
    body: req.body.body,
    attach_files: attach,
  });

  res.status(200).json({
    status: "success",
    data: announcement,
  });
});

exports.deleteAnnouncement = catchAsync(async (req, res, next) => {
  const announcement = await Announcement.findByIdAndDelete(
    req.params.announcementId
  );
  for (attach of announcement.attach_files) {
    fs.unlinkSync(path.join(attach_file, attach.name));
  }
  res.status(204).json({ status: "success" });
});

exports.getAllAnnouncement = catchAsync(async (req, res, next) => {
  const announcements = await Announcement.find({
    courseId: req.params.courseId,
  })
    .select("title announcerId")
    .populate({
      path: "announcerId",
      select: "username photo",
    });

  res.status(200).json({ status: "success", data: announcements });
});

exports.getAnnouncement = catchAsync(async (req, res, next) => {
  const announcement = await Announcement.findById(
    req.params.announcementId
  ).populate({ path: "announcerId", select: "username photo" });

  res.status(200).json({ status: "success", data: announcement });
});
