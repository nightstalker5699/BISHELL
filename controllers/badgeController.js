const Badge = require("../models/badgeModel");
const User = require("../models/userModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const factory = require("./handlerFactory");

exports.getAllBadges = factory.getAll(Badge);
exports.getBadge = factory.getOne(Badge);
exports.createBadge = factory.createOne(Badge);
exports.updateBadge = factory.updateOne(Badge);
exports.deleteBadge = factory.deleteOne(Badge);

exports.assignBadges = catchAsync(async (req, res, next) => {
  // Get all students ordered by points
  const students = await User.find({ role: "student" }).sort({ points: -1 });
  const totalStudents = students.length;
  
  if (totalStudents === 0) {
    return next(new AppError("No students found", 404));
  }
  
  // Get badge references
  const goldBadge = await Badge.findOne({ rank: "gold" });
  const silverBadge = await Badge.findOne({ rank: "silver" });
  const bronzeBadge = await Badge.findOne({ rank: "bronze" });
  const mightyBadge = await Badge.findOne({ rank: "mighty" });
  
  if (!goldBadge || !silverBadge || !bronzeBadge || !mightyBadge) {
    return next(new AppError("Required badges not found", 404));
  }
  
  // Calculate thresholds
  const topTenPercent = Math.max(1, Math.floor(totalStudents * 0.1));
  const topFiftyPercent = Math.max(1, Math.floor(totalStudents * 0.5));
  
  // Assign badges based on ranking
  const updates = [];
  
  for (let i = 0; i < totalStudents; i++) {
    const student = students[i];
    let badgeToAssign;
    
    // Top 3 users get Mighty badge only
    if (i < 3) {
      badgeToAssign = mightyBadge._id;
    }
    // Top 10% (excluding top 3) get Gold badge
    else if (i < topTenPercent) {
      badgeToAssign = goldBadge._id;
    } 
    // Top 10-50% get Silver badge
    else if (i < topFiftyPercent) {
      badgeToAssign = silverBadge._id;
    } 
    // Rest get Bronze badge
    else {
      badgeToAssign = bronzeBadge._id;
    }
    
    updates.push({
      updateOne: {
        filter: { _id: student._id },
        update: { badges: [badgeToAssign] }
      }
    });
  }
  
  // Execute bulk update
  await User.bulkWrite(updates);
  
  res.status(200).json({
    status: "success",
    message: "Badges assigned successfully",
    data: {
      totalStudents,
      topTenPercent,
      topFiftyPercent
    }
  });
});

exports.getUserBadges = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.userId).populate('badges');
  
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  
  res.status(200).json({
    status: "success",
    data: {
      badges: user.badges
    }
  });
});
