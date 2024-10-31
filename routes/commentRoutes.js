const express = require("express");
const commentController = require("./../controllers/commentController");

const router = express.Router({
  mergeParams: true,
});

router.route("/").post(commentController.addComment);
router
  .route("/:id")
  .patch(commentController.updateComment)
  .delete(commentController.deleteComment);

module.exports = router;
