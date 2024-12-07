const fs = require("fs");
const path = require("path");
const catchAsync = require("../utils/catchAsync");
const appError = require("../utils/appError");
const Assigment = require("../models/assigmentModel");
const multer = require("multer");
const uploadDir = path.join(__dirname, "..", "/Assigments");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.memoryStorage();
const uploadSystem = multer({
  storage,
});
exports.assigment = uploadSystem.single("file");
exports.createAssigment = catchAsync(async (req, res, next) => {
  let groups;
  if (req.body.groups) groups = req.body.groups.split("");
  else groups = ["A", "B", "C", "D"];
  const assigment = Assigment.create({});
});
