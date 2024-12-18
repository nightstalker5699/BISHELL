const express = require("express");
const userController = require("../controllers/userController");
const authController = require("../controllers/authController");
const pointController = require("../controllers/pointController");

const router = express.Router();

router
  .route("/givePoint")
  .post(authController.protect, authController.restrictTo("admin"), pointController.givePointToUser);

router.use(authController.protect);
router.get("/leaderboard", pointController.getLeaderBoard);
router.route("/user/:id").get(pointController.getUserLog);
router
  .route("/:id")
  .get(pointController.getpoint)
  .patch(authController.restrictTo("admin"), pointController.updatepoint)
  .delete(authController.restrictTo("admin"), pointController.deletepoint);

router
  .route("/")
  .get(pointController.getAllpoint)
  .post(pointController.createLog);

module.exports = router;
