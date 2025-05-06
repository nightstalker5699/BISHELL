const path = require("path");
const fs = require("fs");
const multer = require("multer");
const catchAsync = require("./../utils/catchAsync");
const appError = require("./../utils/appError");

exports.fileUploader = (path, fieldForm, single) => {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, { recursive: true });
  }

  // create a multer storage object that include destination which is file location and their filename
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path);
    },
    filename: (req, file, cb) => {
      file.originalname = (Date.now() + "-" + file.originalname).replace(
        " ",
        "-"
      );
      cb(null, file.originalname);
    },
  });

  return single
    ? multer({
        storage,
      }).single(fieldForm)
    : multer({
        storage,
      }).array(fieldForm);
};
