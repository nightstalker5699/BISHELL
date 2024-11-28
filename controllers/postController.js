const Course = require("../models/courseModel");
const Post = require("../models/postModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const multer = require("multer");
const sharp = require("sharp");
const fsPromises = require("fs").promises;
const path = require("path");

// Image Upload Configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
});

// Create uploads directory if it doesn't exist

const addPostMetadata = (post, req, userId = null) => {
  const baseImageUrl = `${req.protocol}://${req.get("host")}/img/posts/`;

  // Convert to object to allow modifications
  const postObj = post.toObject();

  // Add image URLs and process content blocks
  postObj.contentBlocks = postObj.contentBlocks.map((block) => {
    if (block.type === "image") {
      return {
        ...block,
        imageUrl: `${baseImageUrl}${block.content}`,
      };
    }
    return block;
  });

  // Add like status if userId provided
  if (userId) {
    postObj.isLiked = post.likes.includes(userId);
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
  if (!req.files) return next();

  // Ensure upload directory exists
  const uploadDir = await createUploadDirs();

  try {
    req.processedImages = await Promise.all(
      req.files.map(async (file, index) => {
        const filename = `post-${req.user.id}-${Date.now()}-${index + 1}.jpeg`;
        const filePath = path.join(uploadDir, filename);

        await sharp(file.buffer)
          .resize(1200, 1200, { fit: "inside" })
          .toFormat("jpeg")
          .jpeg({ quality: 90 })
          .toFile(filePath);

        return filename;
      })
    );
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

exports.getPost = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id)
    .populate("userId", "username photo")
    .populate({
      path: "comments",
      populate: {
        path: "userId",
        select: "username photo",
      },
    });

  if (!post) {
    return next(new AppError("Post not found", 404));
  }

  post.views += 1;
  await post.save({ validateBeforeSave: false });

  const enrichedPost = addPostMetadata(post, req, req.user?._id);

  res.status(200).json({
    status: "success",
    data: { post: enrichedPost },
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
  // Validate required fields
  if (!req.body.title) {
    return next(new AppError("Title is required", 400));
  }

  if (!req.body.content) {
    return next(new AppError("Content is required", 400));
  }

  let contentBlocks;
  try {
    contentBlocks = JSON.parse(req.body.content);
  } catch (err) {
    return next(new AppError("Invalid content format - must be valid JSON", 400));
  }

  const processedBlocks = [];
  let imageIndex = 0;

  for (let index = 0; index < contentBlocks.length; index++) {
    const block = contentBlocks[index];
    if (block.type === "image") {
      if (!req.processedImages || imageIndex >= req.processedImages.length) {
        throw new AppError("Missing image file for image block", 400);
      }
      processedBlocks.push({
        orderIndex: index,
        type: "image",
        content: req.processedImages[imageIndex++],
      });
    } else {
      processedBlocks.push({
        orderIndex: index,
        type: "text",
        content: block.content,
      });
    }
  }

  const post = await Post.create({
    title: req.body.title,
    contentBlocks: processedBlocks,
    userId: req.user.id,
    label: req.body.label,
    courseId: req.body.courseId
  });

  res.status(201).json({
    status: "success",
    data: { post },
  });
});

exports.updatePost = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new AppError("Post not found", 404));
  }

  if (post.userId.toString() !== req.user.id && req.user.role !== "admin") {
    return next(new AppError("Not authorized to update this post", 403));
  }

  if (req.files?.length) {
    // Process new images if any
    const updatedContent = JSON.parse(req.body.content);
    let imageIndex = 0;
    post.contentBlocks = updatedContent.map((block, index) => ({
      orderIndex: index,
      type: block.type,
      content:
        block.type === "image"
          ? req.processedImages[imageIndex++]
          : block.content,
    }));
  }

  Object.assign(post, req.body);
  await post.save();

  res.status(200).json({
    status: "success",
    data: { post },
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
