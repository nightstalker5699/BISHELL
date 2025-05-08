
const express = require("express");
const router = express.Router();
const notesController = require("../controllers/notesController");
const authController = require("../controllers/authController");
const notes = require('../models/noteModel')


router.get("/user/:userId/:courseName", authController.protect, notesController.getUserPosts);
router.get("/user/:userId", authController.protect, notesController.getUserPosts);
router.get("/:username/:slug", authController.optionalProtect, notesController.getPostByUsernameAndSlug);

router
  .route("/:id")
  .patch(
    authController.protect,
    notesController.uploadPostImages,
    notesController.processPostImages,
    notesController.updatePost
  )
  .delete(
    authController.protect,
    authController.isOwner(notes),
    notesController.deletePost
  );

router.post("/:id/toggle-like", authController.protect, notesController.toggleLike);

router.use("/:questionId/comments", authController.protect, require("./commentRoutes"));

router
  .route("/")
  .post(
    authController.protect,
    notesController.uploadPostImages,    
    notesController.processPostImages,   
    notesController.createPost           
  );

router.get("/", authController.protect, authController.restrictTo("admin"), notesController.getAllPosts);

module.exports = router;