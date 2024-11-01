const User = require("../models/userModel");
const toDoList = require("../models/toDoListModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const factory = require("./handlerFactory");
const APIFeatures = require("../utils/apiFeatures");

exports.getAllUsers = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(User.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();
  const users = await features.query;

  res.status(200).json({
    status: 'success',
    results: users.length,
    data: {
      users
    }
  });
});

exports.getMe = (req, res, next) => {
  req.params.username = req.user.username;
  next();
};

exports.getUser = catchAsync(async (req, res, next) => {
  const { username } = req.params;
  const { user } = req;
  const isOwnProfile = user.username === username;

  // Select fields to exclude sensitive information
  const selectFields = '-passwordResetToken -passwordResetTokenExpires -passwordChangedAt';

  // Build the query
  let query = User.findOne({ username }).select(selectFields);

  // Populate toDoList if viewing own profile
  if (isOwnProfile) {
    query = query.populate({ path: 'toDoList', select: 'task isDone' });
  }

  const targetUser = await query;

  if (!targetUser) {
    return next(new AppError("There's no document with this username", 404));
  }

  // Fetch toDoList if allowed and not viewing own profile
  let toDoList = null;
  if (!isOwnProfile && targetUser.showToDo) {
    toDoList = await toDoListModel.find({ userId: targetUser._id });
  }

  // Check if the authenticated user is following the target user
  let isFollowed = null;
  if (!isOwnProfile) {
    isFollowed = user.following.some(id => id.equals(targetUser._id));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user: targetUser,
      toDoList,
      isFollowed,
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

  req.query.fields = 'username,photo';
  const features = new APIFeatures(
    User.find({ _id: { $in: user.followers } }),
    req.query
  )
    .limitFields()
    .sort()
    .paginate();

  const followers = await features.query;

  res.status(200).json({
    status: 'success',
    data: {
      followers,
      totalFollowers: user.followers.length, // Total count of followers
      totalPages: Math.ceil(user.followers.length / (req.query.limit * 1 || 100)),
    },
  });
});

// userController.js

exports.getFollowing = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  req.query.fields = 'username,photo';
  const features = new APIFeatures(
    User.find({ _id: { $in: user.following } }),
    req.query
  )
    .limitFields()
    .sort()
    .paginate();

  const following = await features.query;
  const limit = req.query.limit * 1 || 100; // Add this line

  res.status(200).json({
    status: 'success',
    data: {
      following,
      totalFollowing: user.following.length,
      totalPages: Math.ceil(user.following.length / limit),
    },
  });
});