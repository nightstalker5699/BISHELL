const express = require("express");
const userController = require("../controllers/userController");
const authController = require("../controllers/authController");
const pointController = require("../controllers/pointController");

const router = express.Router();

router.get("/leaderboard", pointController.getLeaderBoard);
router
  .route("/:id")
  .get(pointController.getUserLog)
  .patch(authController.protect, pointController.updatepoint)
  .delete(pointController.deletepoint);

router
  .route("/")
  .get(pointController.getAllpoint)
  .post(authController.protect, pointController.createLog);

module.exports = router;
