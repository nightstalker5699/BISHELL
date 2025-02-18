const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const authController = require("../controllers/authController");
const posts = require('../models/postModel');

// Public routes
router.get("/:username/:slug", authController.optionalProtect, postController.getPostByUsernameAndSlug);

// Protected routes
router.use(authController.protect);

router.get("/user/:userId/:courseName", postController.getUserPosts);
router.get("/user/:userId", postController.getUserPosts);

router.post("/", 
  postController.uploadPostImages,    
  postController.processPostImages,   
  postController.createPost           
);

router.route("/:id")
  .patch(
    postController.uploadPostImages,
    postController.processPostImages,
    postController.updatePost
  )
  .delete(
    authController.isOwner(posts),
    postController.deletePost
  );

router.post("/:id/toggle-like", postController.toggleLike);

// Comments routes
router.use("/:questionId/comments", require("./commentRoutes"));

// Admin only routes
router.get("/", 
  authController.restrictTo("admin"), 
  postController.getAllPosts
);

module.exports = router;