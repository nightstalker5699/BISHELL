const express = require("express");
const authController = require("../controllers/authController");
const projectController = require("../controllers/projectController.js");

const router = express.Router({ mergeParams: true });

router
  .route("/")
  .get(projectController.getAllProject)
  .post(
    authController.restrictTo("admin", "instructor", "group-leader"),
    projectController.attachment,
    projectController.courseInstructor,
    projectController.create
  );

router.use("/:projectId/", require("./teamRoutes.js"));
module.exports = router;
