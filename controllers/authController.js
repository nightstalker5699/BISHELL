const User = require("./../models/userModel");
const Course = require("./../models/courseModel");
const catchAsync = require("./../utils/catchAsync");
const jwt = require("jsonwebtoken");
const AppError = require("./../utils/appError");
const { promisify } = require("util");
const sendEmail = require("./../utils/email");
const crypto = require("crypto");
const generatePasswordResetEmail = require("./../utils/emailTemplates");

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  const cookiesOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    secure: false,
    httpOnly: true,
  };

  user.password = undefined;

  if (process.env.NODE_ENV === "production") cookiesOptions.secure = true;
  res.cookie("jwt", token, cookiesOptions);
  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      newUser: user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  try {
    // 1. Log incoming request data
    console.log('Signup Request:', {
      body: {
        ...req.body,
        password: '[REDACTED]',
        passwordConfirm: '[REDACTED]'
      },
      file: req.file ? {
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : 'No file uploaded'
    });

    // 2. Validate required fields
    const requiredFields = ['username', 'fullName', 'group', 'email', 'password', 'passwordConfirm'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return next(new AppError(`Missing required fields: ${missingFields.join(', ')}`, 400));
    }

    // 3. Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: req.body.email },
        { username: req.body.username }
      ]
    });

    if (existingUser) {
      console.error('User already exists:', {
        email: existingUser.email === req.body.email,
        username: existingUser.username === req.body.username
      });
      return next(new AppError('Email or username already exists', 400));
    }

    // 4. Get student rank
    console.log('Calculating student rank...');
    const rank = await User.countDocuments({ role: "student" });
    console.log('Current student count:', rank);

    // 5. Create user
    console.log('Creating new user...');
    const newUser = await User.create({
      username: req.body.username,
      fullName: req.body.fullName,
      group: req.body.group,
      email: req.body.email,
      photo: req.file ? `user-${req.body.username}.jpeg` : "default.jpg",
      password: req.body.password,
      passwordConfirm: req.body.passwordConfirm,
      rank: rank + 1,
      deviceTokens: req.body.deviceToken ? [req.body.deviceToken] : [],
    }).catch(err => {
      console.error('User creation error:', err);
      throw err;
    });

    console.log('User created successfully:', {
      id: newUser._id,
      username: newUser.username,
      rank: newUser.rank
    });

    // 6. Assign courses
    console.log('Assigning courses...');
    const courses = await Course.find();
    console.log(`Found ${courses.length} courses to assign`);

    try {
      await Promise.all(
        courses.map(async (course) => {
          console.log(`Assigning course: ${course._id} to user: ${newUser._id}`);
          course.studentsId.push(newUser._id);
          await course.save({ validateBeforeSave: false });
        })
      );
      console.log('Courses assigned successfully');
    } catch (err) {
      console.error('Error assigning courses:', err);
      // Cleanup: Delete user if course assignment fails
      await User.findByIdAndDelete(newUser._id);
      throw new AppError('Error assigning courses. Registration failed.', 500);
    }

    // 7. Generate and send token
    console.log('Generating authentication token...');
    createSendToken(newUser, 201, res);

  } catch (error) {
    console.error('Signup process failed:', {
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
});

exports.login = catchAsync(async (req, res, next) => {
  const { identifier, password, deviceToken } = req.body;

  if (deviceToken && typeof deviceToken !== 'string') {
    return next(new AppError('Invalid device token format', 400));
  }

  if (!identifier || !password) {
    return next(
      new AppError("Please provide email or username and password", 400)
    );
  }

  //case-insensitive regex patterns for both email and username
  const emailPattern = new RegExp(`^${identifier}$`, "i");
  const usernamePattern = new RegExp(`^${identifier}$`, "i");

  const user = await User.findOne({
    $or: [{ email: emailPattern }, { username: usernamePattern }],
  }).select("+password");
  
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("Incorrect email/username or password", 401));
  }

  if (deviceToken) {
    if (!user.deviceTokens.includes(deviceToken)) {
      const MAX_TOKENS = 5;
      if (user.deviceTokens.length >= MAX_TOKENS) {
        user.deviceTokens.shift();
      }
      user.deviceTokens.push(deviceToken);
      await user.save({ validateBeforeSave: false });
    }
  }

  createSendToken(user, 200, res);
});

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.jwt) token = req.cookies.jwt;
  else {
    return next(
      new AppError("You are not logged in! Please log in to get access.", 401)
    );
  }

  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError(
        "The user belonging to this token does no longer exist.",
        401
      )
    );
  }
  // 4) Check if user changed password after the token was issued

  if (currentUser.changedPasswordAfter(decoded.iat))
    return next(
      new AppError("User recently changed password! Please log in again.", 401)
    );
  // 5) Grant access to protected route

  req.user = currentUser;
  next();
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403)
      );
    }
    next();
  };
};

exports.isOwner = (Model, idParam = "id", ownerIdField = "userId") =>
  catchAsync(async (req, res, next) => {
    const resourceId = req.params[idParam];

    if (!resourceId) {
      return next(new AppError("No resource ID provided", 400));
    }

    const doc = await Model.findById(resourceId);

    if (!doc) {
      return next(new AppError("No document found with that ID", 404));
    }

    if (!doc[ownerIdField].equals(req.user.id)) {
      return next(new AppError("ما تبطل منيكة", 403));
    }

    next();
  });

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError("There is no user with email address.", 404));
  }

  // 2) Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's email
  const resetURL = `${req.protocol}://${req.get(
    "host"
  )}/api/users/resetPassword/${resetToken}`;
  const html = generatePasswordResetEmail(resetURL);
  try {
    await sendEmail({
      email: user.email,
      subject: "Your password reset token (valid for 10 min)",
      html,
    });

    res.status(200).json({
      status: "success",
      message: "Token sent to email!",
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError("There was an error sending the email. Try again later!"),
      500
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  //1 get user based on token

  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");
  //2 if token has not expired, and there is user, set the new password
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetTokenExpires: { $gt: Date.now() },
  });
  //3 update changedPasswordAt property for the user
  if (!user) {
    return next(new AppError("Token is invalid or has expired", 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetTokenExpires = undefined;
  await user.save();
  //4 log the user in, send JWT
  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  //1 get user from collection

  const user = await User.findById(req.user.id).select("+password");

  //2 check if posted current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError("Your current password is wrong", 401));
  }
  //3 if so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  //4 log user in, send JWT
  createSendToken(user, 200, res);
});

exports.logout = catchAsync(async (req, res, next) => {
  const { deviceToken } = req.body;

  if (!deviceToken) {
    return next(new AppError('Device token is required', 400));
  }

  if (req.user) {
    // Remove the specific device token
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { deviceTokens: deviceToken }
    });
  }

  res.status(200).json({ 
    status: 'success',
    message: 'Successfully logged out'
  });
});