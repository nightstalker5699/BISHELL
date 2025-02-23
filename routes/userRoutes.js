const express = require("express");
const userController = require("../controllers/userController");
const authController = require("./../controllers/authController");
const toDoListRouter = require("./toDoListRoutes");
const router = express.Router();
const multer = require("multer");
const multiPartParser = multer();
// routes

router.post(
  `/signup`,
  userController.uploadProfilePic,
  userController.resizeProfilePic,
  authController.signup
);

router.post(
  "/device-token",
  authController.protect,
  userController.addDeviceToken
);
router.delete(
  "/device-token",
  authController.protect,
  userController.removeDeviceToken
);
router.get("/checkUsername/:username", userController.isUsernameGood);
router.patch(
  "/updateMe",
  authController.protect,
  userController.uploadProfilePic,
  userController.resizeProfilePic,
  userController.updateMe
);

router.use(multiPartParser.any());
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

router.use("/toDoList", toDoListRouter);
router.route("/:username").get(authController.protect, userController.getUser);
router.patch(
  "/updateMyPassword",
  authController.protect,
  authController.updatePassword
);
router.post(`/login`, authController.login);
router.post("/logout", authController.protect, authController.logout);
router.route(`/forgotPassword`).post(authController.forgotPassword);
router.route(`/resetPassword/:token`).patch(authController.resetPassword);

router
  .route(`/`)
  .get(
    authController.protect,
    authController.restrictTo("admin"),
    userController.getAllUsers
  );

module.exports = router;
