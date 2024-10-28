const express = require("express");
const userController = require("../controllers/userController");
const authController = require("./../controllers/authController");

const router = express.Router();

// routes

router.get(
  "/me",
  authController.protect,
  userController.getMe,
  userController.getUser
);

router.post("/:id/follow", authController.protect, userController.followUser);
router.delete(
  "/:id/unfollow",
  authController.protect,
  userController.unfollowUser
);
router.get(
  "/:username/followers",
  authController.protect,
  userController.getFollowers
);
router.get(
  "/:username/following",
  authController.protect,
  userController.getFollowing
);
router.route("/:username").get(authController.protect, userController.getUser);
router.patch(
  "/updateMyPassword",
  authController.protect,
  authController.updatePassword
);
router.post(`/signup`, authController.signup);
router.post(`/login`, authController.login);
router.route(`/forgotPassword`).post(authController.forgotPassword);
router.route(`/resetPassword/:token`).patch(authController.resetPassword);

router.route(`/`).get(authController.protect, userController.getAllUsers);

module.exports = router;
