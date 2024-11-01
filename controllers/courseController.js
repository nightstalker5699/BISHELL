const Course = require("../models/courseModel");
const User = require("../models/userModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const factory = require("./handlerFactory");

exports.getAllCourses = factory.getAll(Course, ['studentsId']);
exports.deleteCourse = factory.deleteOne(Course);
exports.updateCourse = factory.updateOne(Course, ['studentsId']);


// whenever a new course is created all the users have role student will be added automatically
exports.createCourse = catchAsync(async (req, res, next) => {
  // Create the course
  const course = await Course.create(req.body);

  // Fetch all users with the role 'student'
  const users = await User.find({ role: { $in: ['student', 'admin', 'group-leader'] } });

  // Add their IDs to the studentsId field of the course
  course.studentsId = users.map(student => student._id);

  // Save the course
  await course.save();

  res.status(201).json({
    status: "success",
    data: {
      data: course,
    },
  });
});


// Enroll user in a course
exports.enrollUserInCourse = catchAsync(async (req, res, next) => {
    const { courseId, userId } = req.params;
  
    const course = await Course.findById(courseId);
    const user = await User.findById(userId);
  
    if (!course) {
      return next(new AppError("Course not found", 404));
    }
  
    if (!user) {
      return next(new AppError("User not found", 404));
    }
  
    if (!course.studentsId.includes(userId)) {
      course.studentsId.push(userId);
      await course.save({ validateBeforeSave: false });
    }
  
    res.status(200).json({
      status: "success",
      message: "User enrolled in course successfully",
    });
  });

  
//get instructor data of the course

exports.getCourse = catchAsync(async (req, res, next) => {
  const { slug } = req.params;

  // Find the course by ID and populate the instructorId field
  const course = await Course.findOne({slug}).populate({
    path: 'instructorId',
    select: 'username fullName email role' // Select the fields you want to include
  });

  if (!course) {
    return next(new AppError("Course not found", 404));
  }

  if (!course.instructorId) {
    return res.status(200).json({
      status: "success",
      message: `Course doesn't have an instructor!`,
      course: course,
      manualName: course.instructorName
    });
  }

  res.status(200).json({
    status: "success",
    course: course
  });
});