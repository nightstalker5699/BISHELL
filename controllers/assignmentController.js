const Assignment = require("../models/assignmentModel");
const Course = require("../models/courseModel");
const User = require("../models/userModel");
const path = require("path");
const fs = require("fs");
const { NotificationType } = require("../utils/notificationTypes");
const { sendNotificationToUser } = require("../utils/notificationUtil");
const catchAsync = require("../utils/catchAsync");
const appError = require("../utils/appError");
// Controller to create a new assignment
const createAssignment = catchAsync(async (req, res, next) => {
  const { title, description, deadline } = req.body;
  const instructorId = req.user._id;

  // Find the course assigned to this instructor
  const course = await Course.findById(req.params.courseId);

  if (!course) {
    return next(new appError("Course not found", 404));
  }
  if (
    course.instructorId.toString() != instructorId.toString() &&
    req.user.role == "instructor"
  ) {
    return next(
      new appError(
        "You are not authorized to create assignments for this course",
        403
      )
    );
  }
  const newAssignment = new Assignment({
    title,
    description,
    deadline,
    courseId: course._id,
    createdBy: req.user._id,
    attachedFile: req.file ? `assignments/${req.file.filename}` : null,
  });
  await newAssignment.save();

  await newAssignment.populate("createdBy", "username photo");

  // Notify students about the new assignment
  const usersToNotify = course.studentsId;

  const notificationType = NotificationType.NEW_ASSIGNMENT;

  const notificationPromises = usersToNotify.map((user) => {
    const notificationData = {
      title: newAssignment.title,
      assignmentId: newAssignment._id,
      actingUserId: req.user._id,
      courseId: course._id,
      courseName: course.courseName,
    };

    return sendNotificationToUser(user._id, notificationType, notificationData);
  });

  // Wait for all notifications to be sent
  await Promise.all(notificationPromises);

  return res.status(201).json({
    message: "success",
    data: {
      assignment: newAssignment,
    },
  });
});

// Controller to fetch all assignments for a course
const getAssignmentsForCourse = catchAsync(async (req, res, next) => {
  const pageSize = 6;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;
  const courseId = req.params.courseId;
  const assigments = await Assignment.find({
    courseId: courseId,
  })
    .skip(skip)
    .limit(pageSize)
    .sort({ _id: -1 });

  return res.status(200).json({
    message: "success",
    data: {
      assignments: assigments,
    },
  });
});

// Controller to fetch a specific assignment by ID
const getAssignmentById = catchAsync(async (req, res, next) => {
  const assignment = await Assignment.findById(req.params.assignmentId);
  if (!assignment) {
    next(new appError("Assignment not found", 404));
  }

  return res.status(200).json({
    message: "success",
    data: {
      assignment,
    },
  });
});

const updateAssignment = catchAsync(async (req, res, next) => {
  const assignmentId = req.params.assignmentId;
  const { title, description, deadline } = req.body;

  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) {
    return next(new appError("Assignment not found", 404));
  }

  const updates = {};
  if (title) updates.title = title;
  if (description) updates.description = description;
  if (deadline) updates.deadline = deadline;

  let sendDeadlineExtensionNotification = false;
  let sendAssignmentUpdateNotification = false;

  // Check if the deadline has been updated
  if (deadline && deadline !== assignment.deadline.toISOString()) {
    sendDeadlineExtensionNotification = true;
  }

  // Check if assignment details (title or description) have been updated
  if (
    (title && title !== assignment.title) ||
    (description && description !== assignment.description)
  ) {
    sendAssignmentUpdateNotification = true;
  }

  // If new file is uploaded, replace the old file
  if (req.file) {
    // Delete the old file if it exists
    if (assignment.attachedFile) {
      const oldFilePath = path.join(__dirname, "..", assignment.attachedFile);
      fs.unlinkSync(oldFilePath);
    }

    // Set new file path
    updates.attachedFile = req.file.path;
  }

  // Update the assignment
  const updatedAssignment = await Assignment.findByIdAndUpdate(
    assignmentId,
    { $set: updates },
    { new: true }
  );

  // If the deadline was extended, notify students
  if (sendDeadlineExtensionNotification) {
    const course = await Course.findById(updatedAssignment.courseId);
    const usersToNotify = course.studentsId;

    const notificationType = NotificationType.ASSIGNMENT_DEADLINE_EXTENDED;

    const notificationPromises = usersToNotify.map((user) => {
      const notificationData = {
        title: updatedAssignment.title,
        assignmentId: updatedAssignment._id,
        courseId: course._id,
        courseName: course.courseName,
        newDeadline: updatedAssignment.deadline,
      };
      return sendNotificationToUser(
        user._id,
        notificationType,
        notificationData
      );
    });

    await Promise.all(notificationPromises);
  }

  // If assignment details were updated, notify students
  if (sendAssignmentUpdateNotification) {
    const course = await Course.findById(updatedAssignment.courseId);
    const usersToNotify = course.studentsId;

    const notificationType = NotificationType.ASSIGNMENT_UPDATED;

    const notificationPromises = usersToNotify.map((user) => {
      const notificationData = {
        title: updatedAssignment.title,
        assignmentId: updatedAssignment._id,
        courseId: course._id,
        courseName: course.courseName,
      };
      return sendNotificationToUser(
        user._id,
        notificationType,
        notificationData
      );
    });

    await Promise.all(notificationPromises);
  }

  return res.status(200).json({
    message: "Assignment updated successfully",
    assignment: updatedAssignment,
  });
});

// Controller to delete an assignment
const deleteAssignment = catchAsync(async (req, res, next) => {
  const assignment = await Assignment.findByIdAndDelete(req.params.assigmentId);
  if (!assignment) {
    return next(new appError("Assignment not found", 404));
  }

  if (assignment.attachedFile) {
    const filePath = path.join(__dirname, "..", assignment.attachedFile);
    fs.unlinkSync(filePath);
    await assignment.remove();
  }
  return res.status(200).json({ message: "Assignment deleted" });
});

module.exports = {
  createAssignment,
  getAssignmentsForCourse,
  getAssignmentById,
  deleteAssignment,
  updateAssignment,
};
