const express = require("express");
const submissionController = require("../controllers/submissionController");
const authController = require("../controllers/authController");

const router = express.Router({ mergeParams: true });

router.get("/:submissionId/file", submissionController.viewSubmissionFile);

// ─── Student Routes ────────────────────────────────────────────────

// Submit an assignment
router.post(
  "/submit",
  submissionController.upload,
  submissionController.submitAssignment
);

// View your own submission details
router.get("/:studentId/me", submissionController.getSubmissionDetails);

// Edit your own submission
router.patch(
  "/submission/me",
  submissionController.upload,
  submissionController.updateSubmission
);

// Delete your own submission
router.delete("/me", submissionController.deleteSubmission);

// ─── Instructor Routes ─────────────────────────────────────────────

// View all submissions for a specific assignment
router.get(
  "/submissions",
  authController.restrictTo("instructor"),
  submissionController.getSubmissionsForAssignment
);

// View a specific student's submission
router.get(
  "/:studentId",
  authController.restrictTo("instructor"),
  submissionController.getSubmissionDetails
);

// Accept a student's submission
router.patch(
  "/:studentId/accept",
  authController.restrictTo("instructor"),
  submissionController.acceptSubmission
);

// Reject a student's submission with feedback
router.patch(
  "/:studentId/refuse",
  authController.restrictTo("instructor"),
  submissionController.rejectSubmission
);

module.exports = router;
