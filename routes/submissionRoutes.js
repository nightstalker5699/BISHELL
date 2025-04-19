const express = require('express');
const {
  submitAssignment,
  getSubmissionsForAssignment,
  getSubmissionDetails,
  acceptSubmission,
  rejectSubmission,
  updateSubmission,
  deleteSubmission
} = require('../controllers/submissionController');
const authController = require("../controllers/authController");

const upload = require('../middleware/fileUpload');
const router = express.Router();

// ─── Student Routes ────────────────────────────────────────────────

// Submit an assignment
router.post(
  '/:assignmentId/submit',
  authController.protect,
  upload.single('file'),
  submitAssignment
);

// View your own submission details
router.get(
  '/:assignmentId/submission/:studentId/me',
  authController.protect,
  getSubmissionDetails
);

// Edit your own submission
router.put(
  '/:assignmentId/submission/me',
  authController.protect,
  upload.single('file'),
  updateSubmission
);

// Delete your own submission
router.delete(
  '/:assignmentId/submission/me',
  authController.protect,
  deleteSubmission
);

// ─── Instructor Routes ─────────────────────────────────────────────

// View all submissions for a specific assignment
router.get(
  '/:assignmentId/submissions',
   authController.protect,
   authController.restrictTo("instructor"),
   getSubmissionsForAssignment
);

// View a specific student's submission
router.get(
  '/:assignmentId/submission/:studentId',
  authController.protect,
  authController.restrictTo("instructor"),
  getSubmissionDetails
);

// Accept a student's submission
router.put(
  '/:assignmentId/submission/:studentId/accept',
  authController.protect,
  authController.restrictTo("instructor"),
  acceptSubmission
);

// Reject a student's submission with feedback
router.put(
  '/:assignmentId/submission/:studentId/refuse',
  authController.protect,
  authController.restrictTo("instructor"),
  rejectSubmission
);

module.exports = router;
