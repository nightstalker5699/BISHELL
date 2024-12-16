
const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const authController = require("../controllers/authController");
const posts = require('../models/postModel')

router.get("/:username/:slug", postController.getPostByUsernameAndSlug);

// Protected routes
router.use(authController.protect);

router.get("/user/:userId/:courseName", postController.getUserPosts);
router.get("/user/:userId", postController.getUserPosts);
//router.get("/:slug", postController.getPost);


router
.route("/:id")
.patch(
  postController.uploadPostImages,
  postController.processPostImages,
  postController.updatePost
)
.delete(authController.isOwner(posts),postController.deletePost);

router.post("/:id/toggle-like", postController.toggleLike);

router.use("/:questionId/comments", require("./commentRoutes"));

router
.route("/")
.post(
  postController.uploadPostImages,    
  postController.processPostImages,   
  postController.createPost           
);

router.get("/", authController.restrictTo("admin"),postController.getAllPosts);

module.exports = router;