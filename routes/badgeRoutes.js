const express = require("express");
const authController = require("../controllers/authController");
const badgeController = require("../controllers/badgeController");

const router = express.Router();

// Protect all routes after this middleware
router.use(authController.protect);

// Admin only routes
router.use(authController.restrictTo("admin"));

router
  .route("/")
  .get(badgeController.getAllBadges)
  .post(badgeController.createBadge);

router
  .route("/:id")
  .get(badgeController.getBadge)
  .patch(badgeController.updateBadge)
  .delete(badgeController.deleteBadge);

router.post("/assign", badgeController.assignBadges);

// Public route (accessible by any logged-in user)
router.get("/user/:userId", badgeController.getUserBadges);

module.exports = router;
