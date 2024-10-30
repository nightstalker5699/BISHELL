const authController = require("./../controllers/authController");
const postController = require("./../controllers/postController");
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

router.post("/:id/like", postController.likePost);
router.post("/:id/unlike", postController.unlikePost);
module.exports = router;
