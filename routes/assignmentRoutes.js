const express = require("express");
const assignmentController = require("../controllers/assignmentController");
const upload = require("../middleware/fileUpload");
const authController = require("../controllers/authController");
const router = express.Router({
  mergeParams: true,
});

router
  .route("/")
  .get(assignmentController.getAssignmentsForCourse) // Get all assignments for a course
  .post(
    authController.restrictTo("instructor", "admin"),
    upload.single("file"),
    assignmentController.createAssignment
  ); // Create assignment
router
  .route("/:assignmentId")
  .patch(
    authController.restrictTo("instructor", "admin"),
    upload.single("file"),
    assignmentController.updateAssignment
  ) // Update an assignment
  .delete(
    authController.restrictTo("instructor", "admin"),
    assignmentController.deleteAssignment
  ) // Delete an assignment
  .get(assignmentController.getAssignmentById); // Get assignment by ID

module.exports = router;
