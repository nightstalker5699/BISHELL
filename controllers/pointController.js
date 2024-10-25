const User = require("../models/userModel");
const Point = require("../models/pointModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const factory = require("./handlerFactory");
exports.getLeaderBoard = catchAsync(async (req, res, next) => {
  const users = await User.find({ role: "student" }).sort({ rank: 1 });
  res
    .status(200)
    .json({ status: "success", results: users.length, data: users });
});

exports.createLog = catchAsync(async (req, res, next) => {
  const log = await Point.create({
    userId: req.user.id,
    point: req.body.point,
    description: req.body.description,
  });
  res.status(200).json({
    status: "success",
    log,
  });
});
exports.getUserLog = catchAsync(async (req, res, next) => {
  const logs = await Point.find({ userId: req.params.id });
  res.status(200).json({
    status: "success",
    result: logs.length,
    data: logs,
  });
});

exports.getAllpoint = factory.getAll(Point);
exports.deletepoint = factory.deleteOne(Point);
exports.updatepoint = factory.updateOne(Point);
exports.getpoint = factory.getOne(Point);
