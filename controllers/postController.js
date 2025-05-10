const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const multer = require("multer");
const Post = require("../models/postModel");
const User = require("../models/userModel");
const Comment = require("../models/commentModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const Point = require("../models/pointModel");
const { sendNotificationToUser } = require("../utils/notificationUtil");
const { NotificationType } = require("../utils/notificationTypes");
const { processMentions } = require("../utils/mentionUtil");

// Create all necessary upload directories
const createUploadDirectories = () => {
  // Directory for quill uploads
  const quillUploadsDir = path.join(__dirname, "..", "static", "quillUploads");
  if (!fs.existsSync(quillUploadsDir)) {
    console.log(`Creating directory: ${quillUploadsDir}`);
    try {
      fs.mkdirSync(quillUploadsDir, { recursive: true, mode: 0o775 });
      console.log(`Successfully created directory: ${quillUploadsDir}`);
    } catch (error) {
      console.error(`Failed to create directory ${quillUploadsDir}:`, error);
    }
  } else {
    console.log(`Directory already exists: ${quillUploadsDir}`);
  }

  // Directory for post attachments
  const postAttachmentsDir = path.join(__dirname, "..", "static", "postAttachments");
  if (!fs.existsSync(postAttachmentsDir)) {
    console.log(`Creating directory: ${postAttachmentsDir}`);
    try {
      fs.mkdirSync(postAttachmentsDir, { recursive: true, mode: 0o775 });
      console.log(`Successfully created directory: ${postAttachmentsDir}`);
    } catch (error) {
      console.error(`Failed to create directory ${postAttachmentsDir}:`, error);
    }
  } else {
    console.log(`Directory already exists: ${postAttachmentsDir}`);
  }

  // Directory for comment attachments (shared with questions)
  const attachFileDir = path.join(__dirname, "..", "static", "attachFile");
  if (!fs.existsSync(attachFileDir)) {
    console.log(`Creating directory: ${attachFileDir}`);
    try {
      fs.mkdirSync(attachFileDir, { recursive: true, mode: 0o775 });
      console.log(`Successfully created directory: ${attachFileDir}`);
    } catch (error) {
      console.error(`Failed to create directory ${attachFileDir}:`, error);
    }
  } else {
    console.log(`Directory already exists: ${attachFileDir}`);
  }
};

// Create directories on module load
createUploadDirectories();

// Configure multer storage for post attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const postAttachmentsDir = path.join(__dirname, "..", "static", "postAttachments");
    console.log(`Storing attachment in: ${postAttachmentsDir}`);
    cb(null, postAttachmentsDir);
  },
  filename: (req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`;
    console.log(`Generated filename: ${safeName}`);
    cb(null, safeName);
  },
});

// Configure multer storage for comment attachments
const commentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const postAttachmentsDir = path.join(__dirname, "..", "static", "postAttachments");
    console.log(`Storing comment attachment in: ${postAttachmentsDir}`);
    cb(null, postAttachmentsDir);
  },
  filename: (req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`;
    console.log(`Generated filename: ${safeName}`);
    cb(null, safeName);
  },
});

// Quill upload storage configuration
const quillStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const quillUploadsDir = path.join(__dirname, "..", "static", "quillUploads");
    console.log(`Storing quill upload in: ${quillUploadsDir}`);
    cb(null, quillUploadsDir);
  },
  filename: (req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`;
    console.log(`Generated filename: ${safeName}`);
    cb(null, safeName);
  },
});

// Configure multer for post attachments
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
}).array("attachments", 5); // Allow up to 5 attachments

exports.uploadAttachments = upload;

// Upload middleware for post comment attachments (uses attachFile directory)
const commentUpload = multer({ storage: commentStorage }).single("attach_file");
exports.uploadCommentAttachment = commentUpload;

// Upload middleware for quill editor uploads
const quillUpload = multer({ storage: quillStorage }).single("file");
exports.uploadQuillImage = quillUpload;

// Helper functions
const formatUserObject = (user) => {
  if (!user) return null;
  return {
    username: user.username,
    fullName: user.fullName,
    photo: user.photo,
    role: user.role,
    userFrame: user.userFrame,
    badges: user.badges,
  };
};

const formatAttachment = (req, attachment) => {
  if (!attachment || !attachment.name) return null;

  return {
    name: attachment.name,
    size: attachment.size,
    mimeType: attachment.mimeType,
    type: attachment.type,
    url: `${req.protocol}://${req.get("host")}/postAttachments/${attachment.name}`,
  };
};

// Quill upload handler
exports.handleQuillUpload = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError("No file uploaded", 400));
  }

  console.log(`File uploaded: ${req.file.path}`);
  
  // Check if file exists on disk
  if (!fs.existsSync(req.file.path)) {
    console.error(`File not found after upload: ${req.file.path}`);
  } else {
    console.log(`File exists on disk: ${req.file.path}`);
  }

  const fileUrl = `${req.protocol}://${req.get("host")}/quillUploads/${req.file.filename}`;
  console.log(`Generated URL: ${fileUrl}`);

  res.status(200).json({
    status: "success",
    data: {
      url: fileUrl,
      filename: req.file.filename
    },
  });
});

// Delete uploaded photo handler
exports.deleteUploadedPhoto = catchAsync(async (req, res, next) => {
  const filename = req.params.filename;
  
  // Validate filename to prevent directory traversal attacks
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return next(new AppError("Invalid filename", 400));
  }

  const filePath = path.join(__dirname, "..", "static", "quillUploads", filename);
  
  console.log(`Attempting to delete file: ${filePath}`);
  
  try {
    // Check if file exists
    await fsp.access(filePath);
    
    // Delete file
    await fsp.unlink(filePath);
    console.log(`Successfully deleted file: ${filePath}`);
    
    res.status(200).json({
      status: "success",
      message: "File deleted successfully"
    });
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error);
    
    if (error.code === 'ENOENT') {
      return next(new AppError("File not found", 404));
    }
    
    return next(new AppError("Could not delete file", 500));
  }
});

// Create post
exports.createPost = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { content, quillContent, category, title } = req.body;

  if (!title) {
    return next(new AppError("Post title is required", 400));
  }

  const postData = {
    userId,
    title,
    quillContent: JSON.parse(quillContent),
    category,
  };

  // Only add content if it exists
  if (content) {
    postData.content = content;
  }

  // Handle attachments if any
  if (req.files && req.files.length > 0) {
    postData.attachments = req.files.map(file => {
      let fileType = 'other';
      
      if (file.mimetype.startsWith('image/')) {
        fileType = 'image';
      } else if (file.mimetype.startsWith('video/')) {
        fileType = 'video';
      } else if (file.mimetype === 'application/pdf' || 
                file.mimetype === 'application/msword' || 
                file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                file.mimetype === 'application/vnd.ms-excel' ||
                file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                file.mimetype === 'application/vnd.ms-powerpoint' ||
                file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
                file.mimetype === 'text/plain') {
        fileType = 'document';
      }
      
      return {
        name: file.filename,
        size: file.size,
        mimeType: file.mimetype,
        path: file.path,
        type: fileType
      };
    });
  }

  const newPost = await Post.create(postData);

  // Process mentions only if content exists
  if (content) {
    await processMentions(content, userId, "post", newPost._id);
  }

  await newPost.populate({
    path: "userId",
    select: "username fullName photo role userFrame",
  });

  const response = {
    id: newPost._id,
    title: newPost.title,
    content: newPost.content || "",
    quillContent: newPost.quillContent,
    user: formatUserObject(newPost.userId),
    attachments: newPost.attachments.map(attachment => formatAttachment(req, attachment)),
    timestamps: {
      created: newPost.createdAt,
      formatted: new Date(newPost.createdAt).toLocaleString(),
    },
  };

  await Point.create({
    userId: userId,
    point: 5,
    description: "Created a new post",
  });

  res.status(201).json({
    status: "success",
    data: {
      post: response,
    },
  });

  // // Handle notifications in background
  // const user = await User.findById(userId).populate("followers");
  // const notificationPromises = user.followers.map((follower) => {
  //   return sendNotificationToUser(
  //     follower._id,
  //     NotificationType.QUESTION_FOLLOWING, // Reuse this type for now
  //     {
  //       username: user.username,
  //       postId: newPost._id,
  //       actingUserId: user._id,
  //       title: newPost.content.substring(0, 50) + "...",
  //     }
  //   );
  // });

  // Promise.all(notificationPromises).catch((err) => {
  //   console.error("Error sending notifications:", err);
  // });
});

// Get all posts
exports.getAllPosts = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.category) {
    filter.category = req.query.category === "General" ? null : req.query.category;
  }
  if (req.query.bookmark === "true") {
    filter.bookmarkedBy = req.user._id;
  }

  const total = await Post.countDocuments(filter);

  const posts = await Post.find(filter)
    .populate({
      path: "userId",
      select: "username photo fullName role userFrame badges",
    })
    .populate({
      path: "category",
      select: "courseName",
    })
    .sort(req.query.sort ? req.query.sort.split(",").join(" ") : "-createdAt")
    .skip(skip)
    .limit(limit);

  const formattedPosts = posts.map((post) => ({
    id: post._id,
    title: post.title,
    content: post.content || "",
    quillContent: post.quillContent,
    user: formatUserObject(post.userId),
    category: post.category ? post.category.courseName : "General",
    stats: {
      likesCount: post.likes.length,
      isLikedByCurrentUser: req.user ? post.likes.includes(req.user._id) : false,
      bookmarksCount: post.bookmarkedBy.length,
      isbookmarkedByCurrentUser: req.user
        ? post.bookmarkedBy.includes(req.user._id)
        : false,
      commentsCount: post.comments.length,
    },
    attachments: post.attachments.map(attachment => formatAttachment(req, attachment)),
    timestamps: {
      created: post.createdAt,
      formatted: new Date(post.createdAt).toLocaleString(),
    },
  }));

  res.status(200).json({
    status: "success",
    results: posts.length,
    pagination: {
      currentPage: page,
      pages: Math.ceil(total / limit),
    },
    data: {
      posts: formattedPosts,
    },
  });
});

// Get single post
exports.getPost = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;
  const sort = req.query.sort || "-createdAt";

  const post = await Post.findById(req.params.id)
    .populate({
      path: "userId",
      select: "username fullName photo role userFrame badges",
    })
    .populate({
      path: "category",
      select: "courseName",
    });

  if (!post) {
    return next(new AppError("Post not found", 404));
  }

  // Handle view tracking
  if (req.user && req.user._id) {
    const alreadyViewed = post.viewedBy.some(
      (id) => id.toString() === req.user._id.toString()
    );

    if (!alreadyViewed) {
      post.viewedBy.push(req.user._id);
      await post.save({ validateBeforeSave: false });
    }
  } else {
    post.anonymousViews = (post.anonymousViews || 0) + 1;
    await post.save({ validateBeforeSave: false });
  }

  // Get total comments count
  const totalComments = await Comment.countDocuments({
    questionId: post._id
  });

  // Get paginated comments - no parentId filter since we don't have replies in posts
  const comments = await Comment.find({
    questionId: post._id
  })
    .populate({
      path: "userId",
      select: "username fullName photo role userFrame badges",
    })
    .sort(sort)
    .skip(skip)
    .limit(limit);

  const formattedPost = {
    id: post._id,
    title: post.title,
    content: post.content || "",
    quillContent: post.quillContent,
    user: formatUserObject(post.userId),
    category: post.category ? post.category.courseName : "General",
    stats: {
      likesCount: post.likes.length,
      isLikedByCurrentUser: req.user ? post.likes.includes(req.user._id) : false,
      bookmarksCount: post.bookmarkedBy.length,
      isbookmarkedByCurrentUser: req.user
        ? post.bookmarkedBy.includes(req.user._id)
        : false,
      commentsCount: totalComments,
      authViews: post.viewedBy.length,
      anonViews: post.anonymousViews || 0,
      totalViews: post.viewedBy.length + (post.anonymousViews || 0),
    },
    attachments: post.attachments.map(attachment => formatAttachment(req, attachment)),
    timestamps: {
      created: post.createdAt,
      formatted: new Date(post.createdAt).toLocaleString(),
    },
  };

  // Format comments - no replies for posts
  const formatCommentObject = (comment) => ({
    id: comment._id,
    content: comment.content,
    user: {
      id: comment.userId._id,
      username: comment.userId.username,
      fullName: comment.userId.fullName,
      photo: comment.userId.photo,
      userFrame: comment.userId.userFrame,
      badges: comment.userId.badges
    },
    stats: {
      likesCount: comment.likes ? comment.likes.length : 0,
      isLikedByCurrentUser: req.user ? comment.likes.includes(req.user._id) : false
    },
    attachment: comment.attach_file && comment.attach_file.name ? {
      name: comment.attach_file.name,
      size: comment.attach_file.size,
      mimeType: comment.attach_file.mimeType,
      url: `${req.protocol}://${req.get('host')}/postAttachments/${comment.attach_file.name}`
    } : null,
    timestamps: {
      created: comment.createdAt,
      formatted: new Date(comment.createdAt).toLocaleString()
    }
  });

  formattedPost.comments = {
    results: comments.length,
    pagination: {
      totalComments: totalComments,
      currentPage: page,
      totalPages: Math.ceil(totalComments / limit),
      limit,
    },
    data: comments.map(comment => formatCommentObject(comment))
  };

  res.status(200).json({
    status: "success",
    data: {
      post: formattedPost,
    },
  });
});

// Update post
exports.updatePost = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new AppError("Post not found", 404));
  }

  if (post.userId.toString() !== req.user._id.toString()) {
    return next(new AppError("You can only update your own posts", 403));
  }

  // Update fields
  if (req.body.title) {
    post.title = req.body.title;
  }
  
  // Only update content if provided
  if (req.body.content !== undefined) {
    post.content = req.body.content;
  }
  
  post.quillContent = req.body.quillContent ? JSON.parse(req.body.quillContent) : post.quillContent;

  // Handle attachments
  if (req.files && req.files.length > 0) {
    // Delete old attachments
    for (const attachment of post.attachments) {
      const filePath = path.join(__dirname, "..", "static", "postAttachments", attachment.name);
      try {
        await fsp.unlink(filePath);
      } catch (err) {
        console.log(`Could not delete file ${filePath}: ${err.message}`);
      }
    }

    // Add new attachments
    post.attachments = req.files.map(file => {
      let fileType = 'other';
      
      if (file.mimetype.startsWith('image/')) {
        fileType = 'image';
      } else if (file.mimetype.startsWith('video/')) {
        fileType = 'video';
      } else if (file.mimetype === 'application/pdf' || 
                file.mimetype === 'application/msword' || 
                file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                file.mimetype === 'application/vnd.ms-excel' ||
                file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                file.mimetype === 'application/vnd.ms-powerpoint' ||
                file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
                file.mimetype === 'text/plain') {
        fileType = 'document';
      }
      
      return {
        name: file.filename,
        size: file.size,
        mimeType: file.mimetype,
        path: file.path,
        type: fileType
      };
    });
  }

  await post.save();
  await post.populate({
    path: "userId",
    select: "username fullName photo role userFrame",
  });

  const formattedPost = {
    id: post._id,
    title: post.title,
    content: post.content,
    quillContent: post.quillContent,
    user: formatUserObject(post.userId),
    attachments: post.attachments.map(attachment => formatAttachment(req, attachment)),
    timestamps: {
      created: post.createdAt,
      updated: post.updatedAt,
    },
  };

  res.status(200).json({
    status: "success",
    data: {
      post: formattedPost,
    },
  });
});

// Delete post
exports.deletePost = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new AppError("Post not found", 404));
  }

  if (
    post.userId.toString() !== req.user._id.toString() &&
    req.user.role !== "admin" &&
    req.user.role !== "group-leader"
  ) {
    return next(new AppError("You are not authorized to delete this post", 403));
  }

  try {
    // Delete attachments
    for (const attachment of post.attachments) {
      const filePath = path.join(__dirname, "..", "static", "postAttachments", attachment.name);
      try {
        await fsp.unlink(filePath);
      } catch (err) {
        console.log(`Could not delete file ${filePath}: ${err.message}`);
      }
    }

    // Delete comments
    await Comment.deleteMany({ postId: post._id });

    // Delete the post
    await post.deleteOne();

    res.status(204).json({
      status: "success",
      data: null,
    });
  } catch (error) {
    return next(new AppError("Error deleting post and associated data", 500));
  }
});

// Like/Unlike post
exports.likePost = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new AppError("Post not found", 404));
  }

  if (post.likes.includes(req.user._id)) {
    return next(new AppError("You already liked this post", 400));
  }

  post.likes.push(req.user._id);
  await post.save({ validateBeforeSave: false });

  if (post.userId.toString() !== req.user._id.toString()) {
    await Point.create({
      userId: post.userId,
      point: 2,
      description: "Your post received a like",
    });

    await sendNotificationToUser(
      post.userId,
      NotificationType.LIKE_QUESTION, // Reuse this type for now
      {
        username: req.user.username,
        postId: post._id,
        actingUserId: req.user._id,
        title: post.title || post.content.substring(0, 50) + "...",
      }
    );
  }

  res.status(200).json({
    status: "success",
    data: {
      likes: post.likes.length,
    },
  });
});

exports.unlikePost = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new AppError("Post not found", 404));
  }

  if (!post.likes.includes(req.user._id)) {
    return next(new AppError("You have not liked this post", 400));
  }

  post.likes = post.likes.filter((id) => !id.equals(req.user._id));
  await post.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    data: {
      likes: post.likes.length,
    },
  });
});

// Bookmark/Unbookmark post
exports.bookmarkPost = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new AppError("Post not found", 404));
  }

  if (post.bookmarkedBy.includes(req.user._id)) {
    return next(new AppError("You already bookmarked this post", 400));
  }

  post.bookmarkedBy.push(req.user._id);
  await post.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    data: {
      bookmarks: post.bookmarkedBy.length,
    },
  });
});

exports.unbookmarkPost = catchAsync(async (req, res, next) => {
  const post = await Post.findByIdAndUpdate(
    req.params.id,
    {
      $pull: { bookmarkedBy: req.user._id },
    },
    { new: true }
  );

  if (!post) {
    return next(new AppError("Post not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      bookmarks: post.bookmarkedBy.length,
    },
  });
});

// Get post viewers
exports.getPostViewers = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new AppError("Post not found", 404));
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const totalViewers = post.viewedBy.length;

  const viewersData = await User.find(
    { _id: { $in: post.viewedBy } },
    "username fullName photo"
  )
    .skip(skip)
    .limit(limit);

  const formattedViewers = viewersData.map((user) => ({
    username: user.username,
    fullName: user.fullName,
    photo: user.photo,
  }));

  res.status(200).json({
    status: "success",
    data: {
      authenticatedViewers: formattedViewers,
      authenticatedViewsCount: totalViewers,
      anonymousViewsCount: post.anonymousViews || 0,
      totalViews: totalViewers + (post.anonymousViews || 0),
    },
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalViewers / limit),
      limit,
    },
  });
}); 