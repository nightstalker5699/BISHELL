const User = require("../models/userModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const factory = require("./handlerFactory");

exports.getAllUsers = factory.getAll(User);

exports.getMe = (req, res, next) => {
  req.params.username = req.user.username;
  next();
};

exports.getUser = factory.getOne(User);

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
  const user = await User.findById(req.params.id).populate({
    path: 'followers',
    select: 'username photo'
  });

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      followers: user.followers,
      count: user.followers.length
    }
  });
});

exports.getFollowing = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id).populate({
    path: 'following',
    select: 'username photo'
  });

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      following: user.following,
      count: user.following.length
    }
  });
});