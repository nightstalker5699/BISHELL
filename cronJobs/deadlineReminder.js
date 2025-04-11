const cron = require('node-cron');
const Assignment = require('../models/assignmentModel');
const Submission = require('../models/submissionModel');
const Course = require('../models/courseModel');
const User = require('../models/userModel');
const { NotificationType } = require('../utils/notificationTypes');
const { sendNotificationToUser } = require("../utils/notificationUtil");

// Run every day at 8am
cron.schedule('0 8 * * *', async () => {
  try {
    const now = new Date();
    const inTwoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    const assignmentsDueSoon = await Assignment.find({
      deadline: { $gte: now, $lte: inTwoDays }
    });

    for (const assignment of assignmentsDueSoon) {
      const course = await Course.findById(assignment.courseId);
      if (!course) continue;

      const enrolledStudents = course.studentsId;

      for (const student of enrolledStudents) {
        const hasSubmitted = await Submission.findOne({
          assignmentId: assignment._id,
          studentId: student._id
        });

        if (!hasSubmitted) {
          const notificationData = {
            title: assignment.title,
            assignmentId: assignment._id,
            courseId: course._id,
            courseName: course.courseName,
            deadline: assignment.deadline
          };

          await sendNotificationToUser(student._id, NotificationType.UPCOMING_DEADLINE_REMINDER, notificationData);
        }
      }
    }

    console.log('Upcoming deadline reminders sent!');
  } catch (err) {
    console.error('Error in deadline reminder cron job:', err);
  }
});

