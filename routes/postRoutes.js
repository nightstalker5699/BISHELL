const authController = require("./../controllers/authController");
const postController = require("./../controllers/postController");
const commentRoutes = require("./commentRoutes");
const express = require("express");

const router = express.Router();

router.use(authController.protect);

router
  .route("/")
  .get(postController.getAllPost)
  .post(postController.createPost);
router
  .route("/:id")
  .get(postController.getPost)
  .patch(postController.updatePost)
  .delete(postController.deletePost);

router.use("/:postId/comments", commentRoutes);
router.post("/:id/like", postController.likePost);
router.post("/:id/unlike", postController.unlikePost);
module.exports = router;
