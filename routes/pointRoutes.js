const express = require("express");
const userController = require("../controllers/userController");
const authController = require("../controllers/authController");
const pointController = require("../controllers/pointController");

const router = express.Router();

router
  .route("/")
  .get(pointController.getAllpoint)
  .post(authController.protect, pointController.createLog);

router
  .route("/:id")
  .patch(authController.protect, pointController.updatepoint)
  .delete(pointController.deletepoint);
router.get("/me", authController.protect, pointController.getMyLogs);
module.exports = router;
