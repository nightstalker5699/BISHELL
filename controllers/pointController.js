const User = require("../models/userModel");
const Point = require("../models/pointModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const factory = require("./handlerFactory");
exports.getLeaderBoard = catchAsync(async (req, res, next) => {
  let users = await User.find({ role: "student" }).sort({ rank: 1 });
  users = users.map((el) => {
    let name = el.fullName.split(" ");
    el.fullName = name.length <= 2 ? el.fullName : name[0] + " " + name[1];
    return el;
  });

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
  
  // immediate recalculation of points
  await Point.calcuPoints(req.user.id);
  const updatedUser = await User.findById(req.user.id);
  
  res.status(200).json({
    status: "success",
    log,
    updatedPoints: updatedUser.points
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

exports.givePointToUser = catchAsync(async (req, res, next) => {
  const { userId, point, description } = req.body;

  if (!userId || !point || !description) {
    return next(new AppError("Please provide userId, point, and description", 400));
  }

  // Create the log entry
  const log = await Point.create({
    userId,
    point,
    description,
  });

  // immediate point recalc
  await Point.calcuPoints(userId);
  const updatedUser = await User.findById(userId);

  res.status(201).json({
    status: "success",
    data: {
      log,
      updatedPoints: updatedUser.points
    }
  });
});


exports.resetAllPoints = catchAsync(async (req, res, next) => {
  // Option 1 update users to zero points
  await User.updateMany({ role: "student" }, { points: 0 });
  
  // Option 2 delete all point logs
  if (req.body.clearLogs) {
    await Point.deleteMany({}); // Delete all point logs
  }
  
  // Option 3 add negative balancing points for each user
  if (req.body.addCounterLogs) {

    const students = await User.find({ role: "student" });
    for (const student of students) {
      if (student.points > 0) {
        await Point.create({
          userId: student._id,
          point: -student.points, // Negative value to zero out
          description: "Points reset by administrator"
        });
      }
    }
    
    // re-calculate points for all students
    for (const student of students) {
      await Point.calcuPoints(student._id);
    }
  }
  
  // Get updated leaderboard
  let users = await User.find({ role: "student" }).sort({ rank: 1 });
  users = users.map((el) => {
    let name = el.fullName.split(" ");
    el.fullName = name.length <= 2 ? el.fullName : name[0] + " " + name[1];
    return el;
  });

  res.status(200).json({
    status: "success",
    message: "All user points have been reset to zero",
    results: users.length,
    data: users
  });
});


exports.getAllpoint = factory.getAll(Point);
exports.deletepoint = factory.deleteOne(Point);
exports.updatepoint = factory.updateOne(Point);
exports.getpoint = factory.getOne(Point);
