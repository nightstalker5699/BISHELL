const User = require("../models/userModel");
const toDoList = require("../models/toDoListModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const factory = require("./handlerFactory");

exports.getAllUsers = factory.getAll(User);

exports.getMe = (req, res, next) => {
  req.params.username = req.user.username;
  next();
};

exports.getUser = catchAsync(async (req, res, next) => {
  let popOptions;
  if (req.user.username === req.params.username)
    popOptions = { path: "toDoList", select: "task isDone" };
  const targetUser = await User.findOne({ username: req.params.username })
    .populate(popOptions)
    .select(
      "-passwordResetToken -passwordResetTokenExpires -passwordChangedAt"
    );

  if (!targetUser) {
    return next(new AppError("There's no document with this username", 404));
  }
  if (
    targetUser.showToDo === true &&
    req.user.username !== req.params.username
  ) {
    targetUser.toDoList = await toDoList.find({ userId: targetUser._id });
  }
  let isFollowed = null;
  // Check if the current user is trying to get their own data
  if (req.user.username !== req.params.username) {
    // Check if the current user is following the target user
    isFollowed = req.user.following.includes(targetUser._id);
  }

  res.status(200).json({
    status: "success",
    data: {
      user: targetUser,
      isFollowed, // Add the isFollowed field to the response
    },
  });
});

//Follow System

exports.followUser = catchAsync(async (req, res, next) => {
  const userToFollow = await User.findById(req.params.id);
  const currentUser = await User.findById(req.user.id);

  if (!userToFollow || !currentUser) {
    return res.status(404).json({
      status: "failed",
      message: "User not found",
    });
  }

  if (userToFollow._id.equals(currentUser._id)) {
    return res.status(400).json({
      status: "failed",
      message: "You can't follow yourself",
    });
  }

  if (!currentUser.following.includes(userToFollow._id)) {
    currentUser.following.push(userToFollow._id);
    userToFollow.followers.push(currentUser._id);
    await currentUser.save({ validateBeforeSave: false });
    await userToFollow.save({ validateBeforeSave: false });

    res.status(200).json({
      status: "success",
      message: "User followed successfully",
    });
  } else {
    res.status(400).json({ message: "Already following this user" });
  }
});

exports.unfollowUser = catchAsync(async (req, res, next) => {
  const userToUnfollow = await User.findById(req.params.id);
  const currentUser = await User.findById(req.user.id);

  if (!userToUnfollow || !currentUser) {
    return res.status(404).json({ message: "User not found" });
  }

  currentUser.following = currentUser.following.filter(
    (userId) => userId.toString() !== userToUnfollow._id.toString()
  );
  userToUnfollow.followers = userToUnfollow.followers.filter(
    (userId) => userId.toString() !== currentUser._id.toString()
  );

  await currentUser.save({ validateBeforeSave: false });
  await userToUnfollow.save({ validateBeforeSave: false });

  res.status(200).json({ message: "Unfollowed successfully" });
});

exports.getFollowers = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  const page = parseInt(req.query.page) || 1; // Default to page 1
  const limit = parseInt(req.query.limit) || 20; // Default to 20 users per page
  const skip = (page - 1) * limit;

  const followers = await User.find({ _id: { $in: user.followers } })
    .select("username photo")
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    status: "success",
    data: {
      followers,
      totalFollowers: user.followers.length, // Total count of followers
      totalPages: Math.ceil(user.followers.length / limit),
    },
  });
});

// Updated getFollowing with pagination
exports.getFollowing = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  const page = parseInt(req.query.page) || 1; // Default to page 1
  const limit = parseInt(req.query.limit) || 20; // Default to 20 users per page
  const skip = (page - 1) * limit;

  const following = await User.find({ _id: { $in: user.following } })
    .select("username photo")
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    status: "success",
    data: {
      following,
      totalFollowing: user.following.length, // Total count of following users
      totalPages: Math.ceil(user.following.length / limit),
    },
  });
});
