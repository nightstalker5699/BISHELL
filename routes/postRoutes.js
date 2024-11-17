// postRoutes.js
const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const authController = require("../controllers/authController");

// Public routes

// Protected routes
router.use(authController.protect);

router.get("/", postController.getAllPosts);
router.get("/user/:userId/:courseName", postController.getUserPosts);
router.get("/user/:userId", postController.getUserPosts);
router.get("/:id", postController.getPost);

// Create post route with proper middleware chain
router
  .route("/")
  .post(
    postController.uploadPostImages,    // Handle file upload
    postController.processPostImages,   // Process images
    postController.createPost           // Create post
  );

router
  .route("/:id")
  .patch(
    postController.uploadPostImages,
    postController.processPostImages,
    postController.updatePost
  )
  .delete(postController.deletePost);

router.post("/:id/toggle-like", postController.toggleLike);

router.use("/:postId/comments", require("./commentRoutes"));

module.exports = router;