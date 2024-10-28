const express = require("express");
const authController = require("../controllers/authController");
const courseController = require("../controllers/courseController");

const router = express.Router();

// Route to enroll user in a course
router.post(
  "/:courseId/enroll/:userId",
  authController.protect,
  courseController.enrollUserInCourse
);

// Get Course and it's instructor data that teaches the course

router.get(
  "/:courseId",
  authController.protect,
  courseController.getCourse
);

router
  .route("/")
  .get(authController.protect, courseController.getAllCourses)
  .post(
    authController.protect,
    authController.restrictTo("admin"),
    courseController.createCourse
  );


module.exports = router;
