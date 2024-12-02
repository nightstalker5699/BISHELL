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

  
  const schedules = await baseQuery.populate({
    path: 'courseId',
    select: 'courseName instructorName'
  });

  if (!schedules) {
    return next(new AppError('No schedules found for this group', 404));
  }

  
  const dayOrder = {
    'Saturday': 1,
    'Sunday': 2,
    'Monday': 3,
    'Tuesday': 4,
    'Wednesday': 5,
    'Thursday': 6,
    'Friday': 7
  };

  
  const convertTo24Hour = (time) => {
    const [hour, period] = time.split(' ');
    let hourNum = parseInt(hour);
    if (period.toUpperCase() === 'PM' && hourNum !== 12) hourNum += 12;
    if (period.toUpperCase() === 'AM' && hourNum === 12) hourNum = 0;
    return hourNum;
  };

  
  const sortedSchedules = schedules.sort((a, b) => {
    
    const dayDiff = dayOrder[a.day] - dayOrder[b.day];
    if (dayDiff !== 0) return dayDiff;
    
    
    return convertTo24Hour(a.startTime) - convertTo24Hour(b.startTime);
  });

  res.status(200).json({
    status: 'success',
    data: {
      schedules: sortedSchedules
    }
  });
});