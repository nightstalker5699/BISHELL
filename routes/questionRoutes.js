const express = require("express");
const questionController = require("../controllers/questionController");
const commentController = require("../controllers/commentController");
const authController = require("../controllers/authController");

const router = express.Router();

router
  .route("/:id/like")
  .post(authController.protect, questionController.likeQuestion)
  .delete(authController.protect, questionController.unlikeQuestion);

router
  .route("/:id")
  .get(authController.protect,questionController.getQuestion)
  .patch(
    authController.protect,
    questionController.uploadAttachFile,
    questionController.updateQuestion
  )
  .delete(authController.protect, questionController.deleteQuestion);
  

router
  .route("/:questionId/comments/:commentId/like")
  .post(authController.protect, commentController.likeComment)
  .delete(authController.protect, commentController.unlikeComment);

router
  .route("/:questionId/comments/:commentId")
  .patch(
    authController.protect,
    questionController.uploadAttachFile,
    commentController.updateQuestionComment
  )
  .delete(authController.protect, commentController.deleteQuestionComment);

// Comment routes
router
  .route("/:questionId/comments")
  .get(authController.protect, commentController.getAllComments)
  .post(
    authController.protect,
    questionController.uploadAttachFile,
    commentController.addQuestionComment
  );

router
  .route("/:questionId/comments/:commentId")
  .patch(
    authController.protect,
    questionController.uploadAttachFile,
    commentController.updateQuestionComment
  )
  .delete(authController.protect, commentController.deleteQuestionComment);

router
  .route("/:questionId/comments/:commentId/replies")
  .post(
    authController.protect,
    questionController.uploadAttachFile,
    commentController.addReply
  );

router
  .route("/:questionId/verify-comment/:commentId")
  .patch(authController.protect, questionController.verifyComment);

router
  .route("/:questionId/unverify-comment")
  .patch(authController.protect, questionController.unverifyComment);

router
  .route("/")
  .get(authController.protect, questionController.getAllQuestions)
  .post(
    authController.protect,
    questionController.uploadAttachFile,
    questionController.createQuestion
  );

module.exports = router;
