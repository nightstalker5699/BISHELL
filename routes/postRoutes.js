const express = require("express");
const postController = require("../controllers/postController");
const commentController = require("../controllers/commentController");
const authController = require("../controllers/authController");
const multer = require("multer");
const path = require("path");

const router = express.Router();

// Configure multer for Quill uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "..", "static", "quillUploads"));
  },
  filename: (req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Only allow images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed!'), false);
    }
  }
});

// Quill direct upload endpoint
router.post(
  "/upload",
  authController.protect,
  upload.single("file"),
  postController.handleQuillUpload
);

// Post routes
router
  .route("/:id/like")
  .post(authController.protect, postController.likePost)
  .delete(authController.protect, postController.unlikePost);

router
  .route("/:id/bookmark")
  .post(authController.protect, postController.bookmarkPost)
  .delete(authController.protect, postController.unbookmarkPost);

router
  .route("/:id/viewers")
  .get(authController.protect, postController.getPostViewers);

router
  .route("/:id")
  .get(authController.optionalProtect, postController.getPost)
  .patch(
    authController.protect,
    postController.uploadAttachments,
    postController.updatePost
  )
  .delete(authController.protect, postController.deletePost);

// Comment routes
router
  .route("/:postId/comments")
  .get(authController.protect, commentController.getAllPostComments)
  .post(
    authController.protect,
    postController.uploadCommentAttachment,
    commentController.addPostComment
  );

router
  .route("/:postId/comments/:commentId")
  .patch(
    authController.protect,
    postController.uploadCommentAttachment,
    commentController.updatePostComment
  )
  .delete(authController.protect, commentController.deletePostComment);

router
  .route("/:postId/comments/:commentId/like")
  .post(authController.protect, commentController.likePostComment)
  .delete(authController.protect, commentController.unlikePostComment);

router
  .route("/")
  .get(authController.protect, postController.getAllPosts)
  .post(
    authController.protect,
    postController.uploadAttachments,
    postController.createPost
  );

module.exports = router; 