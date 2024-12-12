const fs = require("fs");
const path = require("path");
const User = require("../models/userModel");
const toDoListModel = require("../models/toDoListModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const factory = require("./handlerFactory");
const APIFeatures = require("../utils/apiFeatures");
const multer = require("multer");
const sharp = require("sharp");
const appError = require("../utils/appError");

const storage = multer.memoryStorage({});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new appError("not an image please upload an image", 400), false);
  }
};

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) {
      newObj[el] = obj[el];
    }
  });
  return newObj;
};

const uploadImage = multer({ storage, fileFilter });
exports.getAllUsers = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(User.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();
  const users = await features.query;

  res.status(200).json({
    status: "success",
    results: users.length,
    data: {
      users,
    },
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
  const selectFields =
    "-passwordResetToken -passwordResetTokenExpires -passwordChangedAt";

  // Build the query
  let query = User.findOne({ username }).select(selectFields);

  // Populate toDoList if viewing own profile
  // if (isOwnProfile) {
  //   query = query.populate({ path: "toDoList", select: "task isDone" });
  // }

  const targetUser = await query;

  if (!targetUser) {
    return next(new AppError("There's no document with this username", 404));
  }

  const photoUrl = `${req.protocol}://${req.get("host")}/profilePics/${
    targetUser.photo
  }`;
  targetUser.photo = photoUrl;
  // Fetch toDoList if allowed and not viewing own profile

  if (isOwnProfile || targetUser.showToDo) {
    targetUser.toDoList = await toDoListModel.find({ userId: targetUser._id });
  }

  // Check if the authenticated user is following the target user
  let isFollowed = null;
  if (!isOwnProfile) {
    isFollowed = user.following.some((id) => id.equals(targetUser._id));
  }

  res.status(200).json({
    status: "success",
    data: {
      user: targetUser,
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

  req.query.fields = "username,photo";
  const features = new APIFeatures(
    User.find({ _id: { $in: user.followers } }),
    req.query
  )
    .limitFields()
    .sort()
    .paginate();

  const followers = await features.query;

  res.status(200).json({
    status: "success",
    data: {
      followers,
      totalFollowers: user.followers.length, // Total count of followers
      totalPages: Math.ceil(
        user.followers.length / (req.query.limit * 1 || 100)
      ),
    },
  });
});

// userController.js

exports.getFollowing = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  req.query.fields = "username,photo";
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
    status: "success",
    data: {
      following,
      totalFollowing: user.following.length,
      totalPages: Math.ceil(user.following.length / limit),
    },
  });
});

exports.uploadProfilePic = uploadImage.single("photo");

exports.resizeProfilePic = catchAsync(async (req, res, next) => {
  try {
    // Debug log request
    console.log('Upload request received:', {
      hasFile: !!req.file,
      fileSize: req.file?.size,
      mimeType: req.file?.mimetype
    });

    if (!req.file) {
      console.error('No file uploaded');
      return next(new Error('Please upload an image'));
    }

    // Validate file type
    if (!req.file.mimetype.startsWith('image')) {
      console.error('Invalid file type:', req.file.mimetype);
      return next(new Error('Please upload an image file'));
    }

    // Use username from req.body if req.user is undefined (during signup)
    const username = req.user ? req.user.username : req.body.username;
    if (!username) {
      console.error('Username not found');
      return next(new Error('Username is required'));
    }

    req.body.photo = `user-${username}.jpeg`;

    // Delete old photo only if req.user exists and photo is not default
    if (req.user && req.user.photo !== "default.jpg") {
      const oldPhotoPath = path.join("static", "profilePics", req.user.photo);
      try {
        if (fs.existsSync(oldPhotoPath)) {
          fs.unlinkSync(oldPhotoPath);
          console.log('Old photo deleted:', oldPhotoPath);
        }
      } catch (err) {
        console.error('Error deleting old photo:', err);
        // Continue processing even if old photo deletion fails
      }
    }

    // Process and save the new photo
    const outputPath = `static/profilePics/${req.body.photo}`;
    await sharp(req.file.buffer)
      .toFormat("jpeg")
      .jpeg({ quality: 90 })
      .toFile(outputPath)
      .catch(err => {
        console.error('Sharp processing error:', err);
        throw new Error('Error processing image');
      });

    console.log('Image successfully processed and saved:', outputPath);
    next();

  } catch (error) {
    console.error('Profile pic resize error:', error);
    next(error);
  }
});

exports.updateMe = catchAsync(async (req, res, next) => {
  // Prevent password updates here
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        "This route is not for password updates. Please use /updateMyPassword.",
        400
      )
    );
  }

  // Filter out unwanted fields
  const filteredBody = filterObj(req.body, "fullName", "caption");

  // Handle photo upload
  if (req.file) filteredBody.photo = `user-${req.user.username}.jpeg`;

  // Update user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: "success",
    data: {
      user: updatedUser,
    },
  });
});


exports.addDeviceToken = catchAsync(async (req, res, next) => {
  const { deviceToken } = req.body;

  if (!deviceToken) {
    return next(new AppError('Device token is required', 400));
  }

  const user = await User.findById(req.user._id);

  if (!user.deviceTokens.includes(deviceToken)) {
    // Limit max tokens per user
    const MAX_TOKENS = 5;
    if (user.deviceTokens.length >= MAX_TOKENS) {
      user.deviceTokens.shift();
    }
    user.deviceTokens.push(deviceToken);
    await user.save({ validateBeforeSave: false });
  }

  res.status(200).json({
    status: 'success',
    message: 'Device token added successfully'
  });
});

exports.removeDeviceToken = catchAsync(async (req, res, next) => {
  const { deviceToken } = req.body;

  if (!deviceToken) {
    return next(new AppError('Device token is required', 400));
  }

  await User.findByIdAndUpdate(req.user._id, {
    $pull: { deviceTokens: deviceToken }
  });

  res.status(200).json({
    status: 'success',
    message: 'Device token removed successfully'
  });
});