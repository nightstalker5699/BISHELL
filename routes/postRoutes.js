
const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const authController = require("../controllers/authController");
const posts = require('../models/postModel')


router.get("/user/:userId/:courseName", authController.protect, postController.getUserPosts);
router.get("/user/:userId", authController.protect, postController.getUserPosts);
router.get("/:username/:slug", authController.optionalProtect, postController.getPostByUsernameAndSlug);

router
  .route("/:id")
  .patch(
    authController.protect,
    postController.uploadPostImages,
    postController.processPostImages,
    postController.updatePost
  )
  .delete(
    authController.protect,
    authController.isOwner(posts),
    postController.deletePost
  );

router.post("/:id/toggle-like", authController.protect, postController.toggleLike);

router.use("/:questionId/comments", authController.protect, require("./commentRoutes"));

router
  .route("/")
  .post(
    authController.protect,
    postController.uploadPostImages,    
    postController.processPostImages,   
    postController.createPost           
  );

router.get("/", authController.protect, authController.restrictTo("admin"), postController.getAllPosts);

module.exports = router;