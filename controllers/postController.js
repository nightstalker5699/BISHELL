const Course = require("../models/courseModel");
const User = require("../models/userModel");
const Post = require("../models/postModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const multer = require("multer");
const sharp = require("sharp");
const fsPromises = require("fs").promises;
const path = require("path");
const { sendNotificationToUser } = require("../utils/notificationUtil");
const { NotificationType } = require("../utils/notificationTypes");

// Image Upload Configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
});

// Create uploads directory if it doesn't exist

const addPostMetadata = (post, req, userId = null) => {
  const baseImageUrl = `${req.protocol}://${req.get("host")}/img/posts/`;
  const baseProfileUrl = `${req.protocol}://${req.get("host")}/profilePics/`;

  const postObj = post.toObject();

  // Add image URLs to content if needed
  if (postObj.images) {
    postObj.images = postObj.images.map(img => ({
      ...img,
      url: `${baseImageUrl}${img.filename}`
    }));
  }

  // Add user photo URL if userId is populated
  if (postObj.userId && postObj.userId.photo) {
    postObj.userId.photo = `${baseProfileUrl}${postObj.userId.photo}`;
  }

  // Add like status if userId provided
  if (userId) {
    postObj.isLiked = post.likes.includes(userId);
  }

  // Enrich comments' user photos if comments are populated
  if (postObj.comments && postObj.comments.length > 0) {
    postObj.comments = postObj.comments.map((comment) => {
      if (comment.userId && comment.userId.photo) {
        comment.userId.photo = `${baseProfileUrl}${comment.userId.photo}`;
      }
      return comment;
    });
  }

  return postObj;
};

const createUploadDirs = async () => {
  const uploadDir = path.join(__dirname, "..", "static", "img", "posts");
  try {
    await fsPromises.access(uploadDir);
  } catch (err) {
    await fsPromises.mkdir(uploadDir, { recursive: true });
  }
  return uploadDir;
};

exports.uploadPostImages = upload.array("images", 10);

exports.processPostImages = catchAsync(async (req, res, next) => {
  if (!req.files && !req.body.embeddedImages) return next();

  // Ensure upload directory exists
  const uploadDir = await createUploadDirs();
  req.processedImages = [];

  try {
    // Handle attached files (if any)
    if (req.files && req.files.length > 0) {
      const attachedImages = await Promise.all(
        req.files.map(async (file, index) => {
          const filename = `post-${req.user.id}-${Date.now()}-${index + 1}.jpeg`;
          const filePath = path.join(uploadDir, filename);

          await sharp(file.buffer)
            .resize(1200, 1200, { fit: "inside" })
            .toFormat("jpeg")
            .jpeg({ quality: 90 })
            .toFile(filePath);

          return {
            filename,
            originalname: file.originalname,
            type: 'attachment'
          };
        })
      );
      req.processedImages.push(...attachedImages);
    }

    // Handle embedded images from Quill editor (if any)
    if (req.body.embeddedImages) {
      const embeddedImages = JSON.parse(req.body.embeddedImages);
      const processedEmbedded = await Promise.all(
        embeddedImages.map(async (imageData, index) => {
          // Remove the data:image/jpeg;base64, part
          const base64Data = imageData.data.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          
          const filename = `post-${req.user.id}-embedded-${Date.now()}-${index + 1}.jpeg`;
          const filePath = path.join(uploadDir, filename);

          await sharp(buffer)
            .resize(1200, 1200, { fit: "inside" })
            .toFormat("jpeg")
            .jpeg({ quality: 90 })
            .toFile(filePath);

          return {
            filename,
            originalname: `embedded-image-${index + 1}.jpeg`,
            type: 'embedded',
            placeholder: imageData.placeholder // Original src to replace in HTML
          };
        })
      );
      req.processedImages.push(...processedEmbedded);
    }

    next();
  } catch (error) {
    return next(new AppError(`Error processing images: ${error.message}`, 500));
  }
});

exports.getAllPosts = catchAsync(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const query = Post.find()
    .populate("userId", "username photo")
    .sort("-createdAt")
    .skip(skip)
    .limit(limit);

  const [posts, total] = await Promise.all([query, Post.countDocuments()]);

  // Add metadata to each post
  const enrichedPosts = posts.map((post) =>
    addPostMetadata(post, req, req.user?._id)
  );

  res.status(200).json({
    status: "success",
    data: {
      posts: enrichedPosts,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total,
    },
  });
});

exports.getPostByUsernameAndSlug = catchAsync(async (req, res, next) => {
  const { username, slug } = req.params;

  // Find the user by username (case insensitive)
  const user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  // Find the post by userId and slug
  const post = await Post.findOne({ userId: user._id, slug })
    .populate({
      path: "userId",
      select: "username photo"
    })
    .populate({
      path: "comments",
      populate: {
        path: "userId",
        select: "username photo"
      }
    });

  if (!post) {
    return next(new AppError("No post found with that slug for this user", 404));
  }

  // Increment views and save
  post.views += 1;
  await post.save({ validateBeforeSave: false });

  const enrichedPost = addPostMetadata(post, req, req.user?._id);

  res.status(200).json({
    status: "success",
    data: { post: enrichedPost }
  });
});

exports.getUserPosts = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  let { courseName } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Base query
  let query = { userId };

  // Handle courseName if provided
  if (courseName) {
    // Decode the URL-encoded courseName
    courseName = decodeURIComponent(courseName);

    const course = await Course.findOne({
      courseName: new RegExp(`^${courseName}$`, "i"), // Case insensitive match
    });

    if (!course) {
      return next(new AppError("Course not found", 404));
    }

    query.courseId = course._id;
  }

  const [posts, total] = await Promise.all([
    Post.find(query)
      .populate("userId", "username photo")
      .populate("courseId", "courseName")
      .sort("-createdAt")
      .skip(skip)
      .limit(limit),
    Post.countDocuments({ userId }),
  ]);

  // Add metadata to each post
  const enrichedPosts = posts.map((post) =>
    addPostMetadata(post, req, req.user?._id)
  );

  res.status(200).json({
    status: "success",
    data: {
      posts: enrichedPosts,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total,
    },
  });
});

exports.createPost = catchAsync(async (req, res, next) => {
  if (!req.body.title) {
    return next(new AppError("Title is required", 400));
  }

  if (!req.body.content) {
    return next(new AppError("Content is required", 400));
  }

  let content;
  try {
    content = JSON.parse(req.body.content);
  } catch (err) {
    return next(new AppError("Invalid content format - must be valid JSON", 400));
  }

  // Handle processed images
  const images = [];
  let htmlContent = content.html;

  if (req.processedImages) {
    req.processedImages.forEach(img => {
      if (img.type === 'embedded') {
        // Replace base64 or temporary URLs in HTML with actual image URLs
        const imageUrl = `/img/posts/${img.filename}`;
        htmlContent = htmlContent.replace(img.placeholder, imageUrl);
      }
      images.push({
        filename: img.filename,
        originalname: img.originalname,
        type: img.type
      });
    });
  }

  const post = await Post.create({
    title: req.body.title,
    content: {
      delta: content.delta,
      html: htmlContent // Use the updated HTML with correct image URLs
    },
    images,
    userId: req.user.id,
    label: req.body.label,
    courseId: req.body.courseId,
  });

  const enrichedPost = addPostMetadata(post, req, req.user.id);

  res.status(201).json({
    status: "success",
    data: { post: enrichedPost },
  });

  try {
    // Send notifications to followers
    const user = await User.findById(req.user.id).populate("followers");

    const notificationPromises = user.followers.map((follower) => {
      return sendNotificationToUser(
        follower._id,
        NotificationType.NEW_NOTE,  // Use enum instead of string literal
        {
          username: user.username,
          noteTitle: post.title,
          noteSlug: post.slug
        }
      );
    });

    await Promise.all(notificationPromises);
  } catch (err) {
    console.error("Error sending notifications:", err);
  }
});

exports.updatePost = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new AppError("Post not found", 404));
  }

  if (post.userId.toString() !== req.user.id && req.user.role !== "admin") {
    return next(new AppError("Not authorized to update this post", 403));
  }

  // Handle content update
  if (req.body.content) {
    try {
      const content = JSON.parse(req.body.content);
      let htmlContent = content.html;

      // Handle processed images if any
      if (req.processedImages) {
        req.processedImages.forEach(img => {
          if (img.type === 'embedded') {
            // Replace base64 or temporary URLs in HTML with actual image URLs
            const imageUrl = `/img/posts/${img.filename}`;
            htmlContent = htmlContent.replace(img.placeholder, imageUrl);
          }
        });
      }

      post.content = {
        delta: content.delta,
        html: htmlContent
      };
    } catch (err) {
      return next(new AppError("Invalid content format - must be valid JSON", 400));
    }
  }

  // Handle new images
  if (req.processedImages) {
    const newImages = req.processedImages.map(img => ({
      filename: img.filename,
      originalname: img.originalname,
      type: img.type
    }));
    post.images.push(...newImages);
  }

  // Update other fields
  if (req.body.title) post.title = req.body.title;
  if (req.body.label) post.label = req.body.label;
  if (req.body.courseId) post.courseId = req.body.courseId;

  await post.save();

  // Fetch the updated post with populated fields
  const updatedPost = await Post.findById(post._id)
    .populate("userId", "username photo");

  const enrichedPost = addPostMetadata(updatedPost, req, req.user.id);

  res.status(200).json({
    status: "success",
    data: { post: enrichedPost }
  });
});

exports.deletePost = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new AppError("Post not found", 404));
  }

  const uploadDir = path.join(__dirname, "..", "static", "img", "posts");

  for (const block of post.contentBlocks) {
    if (block.type === "image" && block.content) {
      const imagePath = path.join(uploadDir, block.content);
      try {
        await fsPromises.unlink(imagePath);
      } catch (err) {
        console.error(`Failed to delete image ${imagePath}: ${err.message}`);
      }
    }
  }

  await Post.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: "success",
    data: null,
  });
});

exports.toggleLike = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new AppError("Post not found", 404));
  }

  const userLikeIndex = post.likes.indexOf(req.user.id);

  if (userLikeIndex === -1) {
    post.likes.push(req.user.id);
  } else {
    post.likes.splice(userLikeIndex, 1);
  }

  await post.save();

  res.status(200).json({
    status: "success",
    data: { post },
  });
});
