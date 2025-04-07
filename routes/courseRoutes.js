const express = require("express");
const authController = require("../controllers/authController");
const courseController = require("../controllers/courseController");
const slugify = require("slugify");
const router = express.Router();

router.use(authController.protect);
// Route to enroll user in a course
router.post(
  "/:courseId/enroll/:userId",
  authController.restrictTo("admin"),
  courseController.enrollUserInCourse
);

// Get Course and it's instructor data that teaches the course

router.get("/:slug", courseController.getCourse);

router
  .route("/")
  .get(courseController.getAllCourses)
  .post(authController.restrictTo("admin"), courseController.createCourse);

router.use("/:courseId/announcement", require("./announcementRoutes"));
router.use("/:courseId/project", require("./projectRoutes"));
module.exports = router;
