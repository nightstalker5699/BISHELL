const express = require("express");
const announcementController = require("../controllers/announcementController");
const authController = require("../controllers/authController");

const router = express.Router({
  mergeParams: true,
});

router
  .route("/")
  .get(announcementController.getAllAnnouncement)
  .post(
    authController.restrictTo("admin", "instructor"),
    announcementController.attachment,
    announcementController.createAnnouncement
  );
router
  .route("/:announcementId")
  .get(announcementController.getAnnouncement)
  .delete(
    authController.restrictTo("admin", "instructor"),
    announcementController.deleteAnnouncement
  );

module.exports = router;
