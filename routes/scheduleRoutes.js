const express = require("express");
const scheduleController = require("../controllers/scheduleController");
const authController = require("../controllers/authController");

const router = express.Router();

router.use(authController.protect);

router
  .route("/:groupLetter")
  .get(scheduleController.getSchedule);


router.use(authController.restrictTo('admin'));
router
  .route("/")
  .get(scheduleController.getAllSchedule)
  .post(scheduleController.createSchedule);

module.exports = router;