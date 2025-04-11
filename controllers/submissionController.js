const Submission = require('../models/submissionModel');
const Assignment = require('../models/assignmentModel');
const Course = require('../models/courseModel');
const User = require('../models/userModel');
const path = require('path');
const fs = require('fs');
const { NotificationType } = require('../utils/notificationTypes');
const { sendNotificationToUser } = require("../utils/notificationUtil");


// Controller to submit an assignment
const submitAssignment = async (req, res) => {
    try {
      const { realName, group } = req.body;
      const studentId = req.user._id; 
      const assignmentId = req.params.assignmentId;
  
      // Check if the assignment exists
      const assignment = await Assignment.findById(assignmentId);
      if (!assignment) {
        return res.status(404).json({ message: 'Assignment not found' });
      }
  
      // Check if the student already submitted this assignment
      const existingSubmission = await Submission.findOne({ assignmentId, studentId });
      if (existingSubmission) {
        return res.status(400).json({ message: 'You have already submitted this assignment' });
      }
  
      // Check if the deadline has passed
      if (new Date() > new Date(assignment.deadline)) {
        return res.status(400).json({ message: 'The assignment deadline has passed' });
      }
  
      const newSubmission = new Submission({
        assignmentId,
        studentId,
        realName,
        file: req.file.path,
        group,
        status: 'pending',
      });
  
      await newSubmission.save();
  
      // find the course related to the assignment
      const course = await Course.findById(assignment.courseId);
      if (!course) {
        return res.status(404).json({ message: 'Course not found' });
      }
  
      // Find the instructor for the course
      const instructor = assignment.createdBy;
      if (!instructor) {
        return res.status(404).json({ message: 'Instructor not found' });
      }
  
      // Create notification for the instructor
      const notificationData = {
        title: assignment.title,
        assignmentId: assignment._id,
        courseId: course._id,
        courseName: course.courseName,
        studentId: studentId,
        username:  realName, 
      };
  
      await sendNotificationToUser(instructor._id, NotificationType.NEW_SUBMISSION, notificationData);
  
      return res.status(201).json(newSubmission);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error' });
    }
  };
  


const getSubmissionsForAssignment = async (req, res) => {
    const { assignmentId } = req.params;
  
    try {
      // Optional: Validate assignment ID format
      if (!assignmentId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ message: 'Invalid assignment ID format' });
      }
  
      // Find submissions with student details
      const submissions = await Submission.find({ assignmentId })
        .populate({
          path: 'studentId',
          select: 'fullName email' 
        });
  
      if (submissions.length === 0) {
        return res.status(404).json({ message: 'No submissions found for this assignment' });
      }
  
      return res.status(200).json({
        message: 'Submissions retrieved successfully',
        total: submissions.length,
        submissions
      });
    } catch (err) {
      console.error('Error retrieving submissions:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  };
  

const getSubmissionDetails = async (req, res) => {
    const { assignmentId, studentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
  
    try {
      const submission = await Submission.findOne({ assignmentId, studentId });
      if (!submission) {
        return res.status(404).json({ message: 'Submission not found' });
      }
  
      if (userRole === 'student') {
        if (studentId !== userId.toString()) {
          return res.status(403).json({ message: 'Access denied' });
        }
      } else if (userRole === 'instructor') {
        
        const assignment = await Assignment.findById(assignmentId);
        if (!assignment || assignment.createdBy.toString() !== userId.toString()) {
          return res.status(403).json({ message: 'Not your assignment' });
        }
      } else {
        return res.status(403).json({ message: 'Unauthorized role' });
      }
  
      return res.status(200).json(submission);
    } catch (err) {
      return res.status(500).json({ message: 'Server error' });
    }
};
  


// Controller to accept a submission
const acceptSubmission = async (req, res) => {
    const { assignmentId, studentId } = req.params;
  
    try {
      const submission = await Submission.findOne({ assignmentId, studentId });
      if (!submission) {
        return res.status(404).json({ message: 'Submission not found' });
      }
  
      submission.status = 'accepted';
      await submission.save();
  
      // Send notification to the student
      const assignment = await Assignment.findById(assignmentId);

      if (!assignment.courseId) {
        return res.status(400).json({ message: 'This assignment has no course linked' });
      }
      
      const course = await Course.findById(assignment.courseId);
  
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
  
      return res.status(200).json({ message: 'Submission accepted', submission });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error' });
    }
};
  
 


const rejectSubmission = async (req, res) => {
    const { assignmentId, studentId } = req.params;
  
    try {
      const submission = await Submission.findOne({ assignmentId, studentId });
      if (!submission) {
        return res.status(404).json({ message: 'Submission not found' });
      }
  
      submission.status = 'rejected';
      submission.feedback = req.body.feedback; // feedback from professor
      await submission.save();
  
      const assignment = await Assignment.findById(assignmentId);
      if (!assignment) {
        return res.status(404).json({ message: 'Assignment not found' });
      }
  
      const course = await Course.findById(assignment.courseId);
      if (!course) {
        return res.status(404).json({ message: 'Course not found' });
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
  
      return res.status(200).json({ message: 'Submission rejected and student notified' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error' });
    }
};
  

const updateSubmission = async (req, res) => {
    const { assignmentId } = req.params;
    const studentId = req.user._id;
    const updates = req.body;

    try {
        const submission = await Submission.findOne({ assignmentId, studentId });
        if (!submission) {
        return res.status(404).json({ message: 'Submission not found' });
        }

        if (submission.status === 'accepted') {
        return res.status(403).json({ message: 'Cannot edit an accepted submission' });
        }

        // Handle file replacement
        if (req.file) {
        // Delete old file if it exists
        if (submission.file) {
            const oldFilePath = path.join(__dirname, '..', submission.file);
            fs.unlink(oldFilePath, (err) => {
            if (err) console.error('Failed to delete old file:', err);
            });
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
        return res.status(404).json({ message: 'Assignment not found' });
        }

        const course = await Course.findById(assignment.courseId);
        if (!course) {
        return res.status(404).json({ message: 'Course not found' });
        }

        const instructor = assignment.createdBy;
        if (!instructor) {
        return res.status(404).json({ message: 'Instructor not found' });
        }

        // Notification data for the instructor
        const notificationData = {
        title: assignment.title,
        assignmentId: assignment._id,
        studentId: studentId,
        courseId: course._id,
        courseName: course.courseName,
        username: submission.realName
        };

        // Send notification to instructor
        await sendNotificationToUser(instructor._id, NotificationType.RESUBMISSION_BY_STUDENT, notificationData);

        return res.status(200).json({ message: 'Submission updated', submission });
    } catch (err) {
        console.error('Error updating submission:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};


  
const deleteSubmission = async (req, res) => {
  const { assignmentId } = req.params;
  const studentId = req.user._id;

  try {
    const submission = await Submission.findOne({ assignmentId, studentId });

    if (!submission) return res.status(404).json({ message: 'Submission not found' });

    if (submission.status !== 'pending') {
      return res.status(403).json({ message: 'Cannot delete a reviewed submission' });
    }

    await Submission.deleteOne({ _id: submission._id });
    return res.status(200).json({ message: 'Submission deleted successfully' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
};

  

module.exports = { submitAssignment, getSubmissionsForAssignment, acceptSubmission, rejectSubmission , updateSubmission , deleteSubmission , getSubmissionDetails };
