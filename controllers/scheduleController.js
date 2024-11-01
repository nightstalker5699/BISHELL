const Schedule = require("../models/scheduleModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const factory = require("./handlerFactory");
const Course = require("../models/courseModel");

exports.createSchedule = factory.createOne(Schedule);
exports.getAllSchedule = factory.getAll(Schedule);
exports.getSchedule = catchAsync(async (req, res, next) => {
  const groupLetter = req.params.groupLetter;

  // Find schedules by group letter and populate the course details
  const schedules = await Schedule.find({ group: groupLetter }).populate({
    path: 'courseId',
    select: 'courseName instructorName' // Select the fields you want to include
  });

  if (!schedules) {
    return next(new AppError('No schedules found for this group', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      schedules
    }
  });
});
