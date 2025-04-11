const express = require('express');
const { createAssignment, getAssignmentsForCourse, getAssignmentById, deleteAssignment , updateAssignment } = require('../controllers/assignmentController');
const upload = require('../middleware/fileUpload');
const authController = require("../controllers/authController");
const router = express.Router();

// Instructors' routes
router.post('/', authController.protect, authController.restrictTo("instructor"), upload.single('file'), createAssignment); // Create assignment
router.put('/:id', authController.protect, authController.restrictTo("instructor"), upload.single('file'), updateAssignment); // Update an assignment 
router.delete('/:id', authController.protect, authController.restrictTo("instructor"), deleteAssignment); // Delete an assignment

// Both instructor and student routes
router.get('/course/:courseId', authController.protect, getAssignmentsForCourse); // Get all assignments for a course
router.get('/:id', authController.protect, getAssignmentById); // Get a specific assignment

module.exports = router;
