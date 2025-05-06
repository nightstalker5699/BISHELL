const Submission = require("../models/submissionModel");
const Assignment = require("../models/assignmentModel");
const Course = require("../models/courseModel");
const User = require("../models/userModel");
const path = require("path");
const fs = require("fs");
const { NotificationType } = require("../utils/notificationTypes");
const { sendNotificationToUser } = require("../utils/notificationUtil");
const appError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const { fileUploader } = require("../utils/fileUploader");
const apiFeatures = require("../utils/apiFeatures");
const attachedFilePath = path.join(__dirname, "..", "uploads", "submissions");
if (!fs.existsSync(attachedFilePath)) {
  fs.mkdirSync(attachedFilePath, { recursive: true });
}

// Controller to submit an assignment
const submitAssignment = catchAsync(async (req, res, next) => {
  const { realName, group } = req.body;
  const studentId = req.user._id;
  const assignmentId = req.params.assignmentId;

  // Check if the assignment exists
  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) {
    return next(new appError("Assignment not found", 404));
  }

  // Check if the student already submitted this assignment
  const existingSubmission = await Submission.findOne({
    assignmentId,
    studentId,
  });
  if (existingSubmission) {
    return next(
      new appError("You have already submitted this assignment", 400)
    );
  }

  // Check if the deadline has passed
  if (new Date() > new Date(assignment.deadline)) {
    return next(new appError("Submission deadline has passed", 400));
  }

  const newSubmission = new Submission({
    assignmentId,
    studentId,
    realName,
    file: path.join("uploads", "submissions", req.file.originalname),
    group,
    status: "pending",
  });

  await newSubmission.save();

  // find the course related to the assignment
  const course = await Course.findById(assignment.courseId);

  // Find the instructor for the course
  const instructor = assignment.createdBy;

  // Create notification for the instructor
  const notificationData = {
    title: assignment.title,
    assignmentId: assignment._id,
    courseId: course._id,
    courseName: course.courseName,
    studentId: studentId,
    username: realName,
  };

  await sendNotificationToUser(
    instructor._id,
    NotificationType.NEW_SUBMISSION,
    notificationData
  );

  return res
    .status(201)
    .json({ message: "success", submission: newSubmission });
});

const getSubmissionsForAssignment = catchAsync(async (req, res, next) => {
  const { assignmentId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Optional: Validate assignment ID format
  if (!assignmentId.match(/^[0-9a-fA-F]{24}$/)) {
    return next(new appError("Invalid assignment ID format", 400));
  }

  // Find submissions with student details
  let submissions = new apiFeatures(
    Submission.find({ assignmentId }).populate({
      path: "studentId",
      select: "fullName email",
    }),
    req.query
  )
    .filter()
    .sort()
    .limitFields();
  submissions.query = submissions.query.skip(skip).limit(limit);
  submissions = await submissions.query;
  const total = await Submission.countDocuments({ assignmentId });
  const totalPages = Math.ceil(total / limit);

  if (submissions.length === 0) {
    return next(new appError("No submissions found for this assignment", 404));
  }

  return res.status(200).json({
    message: "Submissions retrieved successfully",
    total: submissions.length,
    submissions,
    pagination: {
      currentPage: page,
      totalPages: totalPages,
    },
  });
});

const getSubmissionDetails = catchAsync(async (req, res, next) => {
  const { assignmentId, studentId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  const submission = await Submission.findOne({ assignmentId, studentId });
  if (!submission) {
    return next(new appError("Submission not found", 404));
  }

  if (userRole === "student") {
    if (studentId !== userId.toString()) {
      return next(
        new appError("You are not authorized to view this submission", 403)
      );
    }
  } else if (userRole === "instructor") {
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment || assignment.createdBy.toString() !== userId.toString()) {
      return next(new appError("Not your assignment", 403));
    }
  } else {
    return next(new appError("Unauthorized role", 403));
  }

  return res.status(200).json(submission);
});

// Controller to accept a submission
const acceptSubmission = catchAsync(async (req, res, next) => {
  const { assignmentId, studentId } = req.params;

  const submission = await Submission.findOne({ assignmentId, studentId });
  if (!submission) {
    return next(new appError("Submission not found", 404));
  }

  submission.status = "accepted";
  await submission.save();

  // Send notification to the student
  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) {
    return next(new appError("Assignment not found", 404));
  }

  const course = await Course.findById(assignment.courseId);
  if (!course) {
    return next(new appError("Course not found", 404));
  }

  const notificationData = {
    title: assignment.title,
    assignmentId: assignment._id,
    courseId: course._id,
    courseName: course.courseName,
  };

  await sendNotificationToUser(
    studentId,
    NotificationType.SUBMISSION_ACCEPTED,
    notificationData
  );

  return res.status(200).json({ message: "Submission accepted", submission });
});

const rejectSubmission = catchAsync(async (req, res, next) => {
  const { assignmentId, studentId } = req.params;

  const submission = await Submission.findOne({ assignmentId, studentId });
  if (!submission) {
    return next(new appError("Submission not found", 404));
  }

  submission.status = "rejected";
  submission.feedback = req.body.feedback; // feedback from professor
  await submission.save();

  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) {
    return next(new appError("Assignment not found", 404));
  }

  const course = await Course.findById(assignment.courseId);
  if (!course) {
    return next(new appError("Course not found", 404));
  }

  const notificationType = NotificationType.SUBMISSION_REJECTED;

  const notificationData = {
    title: assignment.title,
    assignmentId: assignment._id,
    actingUserId: req.user._id, // instructor
    courseId: course._id,
    courseName: course.courseName,
  };

  await sendNotificationToUser(studentId, notificationType, notificationData);

  return res
    .status(200)
    .json({ message: "Submission rejected and student notified" });
});

const updateSubmission = catchAsync(async (req, res, next) => {
  const { assignmentId } = req.params;
  const studentId = req.user._id;
  const updates = req.body;

  const submission = await Submission.findOne({ assignmentId, studentId });
  if (!submission) {
    return next(new appError("Submission not found", 404));
  }

  if (submission.status === "accepted") {
    return next(new appError("Cannot update an accepted submission", 403));
  }

  // Handle file replacement
  if (req.file) {
    // Delete old file if it exists
    if (submission.file) {
      const oldFilePath = path.join(__dirname, "..", submission.file);
      fs.unlinkSync(oldFilePath); // Remove the old file
    }

    // Set new file path
    submission.file = req.file.path;
  }

  // Apply any other text updates
  Object.assign(submission, updates);
  submission.submittedAt = new Date(); // refresh timestamp
  await submission.save();

  // Get the assignment and course to notify the instructor
  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) {
    return next(new appError("Assignment not found", 404));
  }

  const course = await Course.findById(assignment.courseId);
  if (!course) {
    return next(new appError("Course not found", 404));
  }

  const instructor = assignment.createdBy;

  // Notification data for the instructor
  const notificationData = {
    title: assignment.title,
    assignmentId: assignment._id,
    studentId: studentId,
    courseId: course._id,
    courseName: course.courseName,
    username: submission.realName,
  };

  // Send notification to instructor
  await sendNotificationToUser(
    instructor._id,
    NotificationType.RESUBMISSION_BY_STUDENT,
    notificationData
  );

  return res.status(200).json({ message: "Submission updated", submission });
});

const deleteSubmission = catchAsync(async (req, res, next) => {
  const { assignmentId } = req.params;
  const studentId = req.user._id;

  const submission = await Submission.findOne({ assignmentId, studentId });

  if (!submission) return next(new appError("Submission not found", 404));

  if (submission.status !== "pending") {
    return next(
      new appError("Cannot delete an accepted or rejected submission", 403)
    );
  }
  if (submission.file) {
    const oldFilePath = path.join(__dirname, "..", submission.file);
    fs.unlinkSync(oldFilePath); // Remove the old file
  }
  await Submission.deleteOne({ _id: submission._id });
  return res.status(200).json({ message: "Submission deleted successfully" });
});

const viewSubmissionFile = catchAsync(async (req, res, next) => {
  const { submissionId } = req.params;

  const submission = await Submission.findById(submissionId);
  if (!submission) {
    return next(new appError("Submission not found", 404));
  }
  if (
    req.user.role !== "instructor" &&
    submission.studentId.toString() !== req.user._id.toString()
  ) {
    return next(
      new appError("You are not authorized to view this submission", 403)
    );
  }
  const filePath = path.join(__dirname, "..", submission.file);
  try {
    await fs.promises.access(filePath);
  } catch (err) {
    return next(new appError(" the requested File does not exist", 404));
  }
  const stream = fs.createReadStream(filePath);
  stream.on("error", (err) => {
    res.end();
    return next(new appError("File not found", 404));
  });

  stream.pipe(res);
});

module.exports = {
  submitAssignment,
  getSubmissionsForAssignment,
  acceptSubmission,
  rejectSubmission,
  updateSubmission,
  deleteSubmission,
  getSubmissionDetails,
  upload: fileUploader(attachedFilePath, "file", true), // Middleware to handle file upload
  viewSubmissionFile,
};
