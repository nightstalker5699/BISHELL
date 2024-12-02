const Schedule = require("../models/scheduleModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const factory = require("./handlerFactory");
const Course = require("../models/courseModel");
const apiFeatures = require('../utils/apiFeatures')

exports.createSchedule = factory.createOne(Schedule);
exports.getAllSchedule = factory.getAll(Schedule);
exports.getSchedule = catchAsync(async (req, res, next) => {
  const groupLetter = req.params.groupLetter;
  const baseQuery = Schedule.find({ group: groupLetter });
  
  const features = new apiFeatures(baseQuery, { sort: 'day,startTime' })
    .sort();

  const schedules = await features.query.populate({
    path: 'courseId',
    select: 'courseName instructorName'
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
