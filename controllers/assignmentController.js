const Assignment = require('../models/assignmentModel');
const Course = require('../models/courseModel');
const User = require("../models/userModel");
const path = require('path');
const fs = require('fs');
const { NotificationType } = require('../utils/notificationTypes');
const { sendNotificationToUser } = require("../utils/notificationUtil");



// Controller to create a new assignment
const createAssignment = async (req, res) => {
    try {
      const { title, description, deadline } = req.body;
      const instructorId = req.user._id;
  
      // Find the course assigned to this instructor
      const course = await Course.findOne({ instructorId: instructorId });
  
      if (!course) {
        return res.status(404).json({ message: 'No course assigned to this instructor' });
      }
  
      const newAssignment = new Assignment({
        title,
        description,
        deadline,
        courseId: course._id,
        createdBy: req.user._id,
        attachedFile: req.file ? req.file.path : null,
      });
  
      await newAssignment.save();
  
      // Link the assignment to the course
      course.assignments.push(newAssignment._id);
      await course.save();
  
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
  
      return res.status(201).json(newAssignment);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error' });
    }
};
  

// Controller to fetch all assignments for a course
const getAssignmentsForCourse = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const course = await Course.findById(courseId).populate('assignments');
    
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    return res.status(200).json(course.assignments);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Controller to fetch a specific assignment by ID
const getAssignmentById = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    return res.status(200).json(assignment);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};


const updateAssignment = async (req, res) => {
    try {
      const assignmentId = req.params.id;
      const { title, description, deadline } = req.body;
  
      const assignment = await Assignment.findById(assignmentId);
      if (!assignment) {
        return res.status(404).json({ message: 'Assignment not found' });
      }
  
      const updates = {
        title,
        description,
        deadline,
        updatedAt: Date.now()
      };
  
      let sendDeadlineExtensionNotification = false;
      let sendAssignmentUpdateNotification = false;
  
      // Check if the deadline has been updated
      if (deadline && deadline !== assignment.deadline.toISOString()) {
        sendDeadlineExtensionNotification = true;
      }
  
      // Check if assignment details (title or description) have been updated
      if (title && title !== assignment.title || description && description !== assignment.description) {
        sendAssignmentUpdateNotification = true;
      }
  
      // If new file is uploaded, replace the old file
      if (req.file) {
        // Delete the old file if it exists
        if (assignment.attachedFile) {
          const oldFilePath = path.join(__dirname, '..', assignment.attachedFile);
          fs.unlink(oldFilePath, (err) => {
            if (err) console.error('Failed to delete old file:', err);
          });
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
          return sendNotificationToUser(user._id, notificationType, notificationData);
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
          return sendNotificationToUser(user._id, notificationType, notificationData);
        });
  
        await Promise.all(notificationPromises);
      }
  
      return res.status(200).json({
        message: 'Assignment updated successfully',
        assignment: updatedAssignment,
      });
  
    } catch (error) {
      console.error('Error updating assignment:', error);
      return res.status(500).json({ message: 'Server error' });
    }
};
  




// Controller to delete an assignment
const deleteAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findByIdAndDelete(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // Remove the assignment from the course's assignments array
    await Course.updateOne(
      { _id: assignment.courseId },
      { $pull: { assignments: assignment._id } }
    );

    return res.status(200).json({ message: 'Assignment deleted' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createAssignment, getAssignmentsForCourse, getAssignmentById, deleteAssignment , updateAssignment };
