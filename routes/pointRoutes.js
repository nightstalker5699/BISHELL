const express = require("express");
const userController = require("../controllers/userController");
const authController = require("../controllers/authController");
const pointController = require("../controllers/pointController");

const router = express.Router();

router.get("/leaderboard", pointController.getLeaderBoard);
router.route("/user/:id").get(pointController.getUserLog);
router
  .route("/:id")
  .get(pointController.getpoint)
  .patch(authController.protect, pointController.updatepoint)
  .delete(pointController.deletepoint);

router
  .route("/")
  .get(pointController.getAllpoint)
  .post(authController.protect, pointController.createLog);

module.exports = router;
