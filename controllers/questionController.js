const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const multer = require("multer");
const Question = require("../models/questionModel");
const User = require("../models/userModel");
const Comment = require("../models/commentModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const mime = require("mime-types");
const APIFeatures = require("../utils/apiFeatures");
const Point = require("../models/pointModel");
const { sendNotificationToUser } = require("../utils/notificationUtil");
const { NotificationType } = require("../utils/notificationTypes");
const { processMentions } = require("../utils/mentionUtil");
const { getSecureAttachmentUrl } = require("../utils/urlUtils");

// Create attachFile directory if it doesn't exist
const attachFileDir = path.join(__dirname, "..", "static", "attachFile");
if (!fs.existsSync(attachFileDir)) {
  fs.mkdirSync(attachFileDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, attachFileDir);
  },
  filename: (req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`;
    cb(null, safeName);
  },
});

const upload = multer({ storage }).single("attach_file");
exports.uploadAttachFile = upload;

// Helper functions to reduce code duplication
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

const formatSimpleUserObject = (user) => {
  if (!user) return null;
  return {
    username: user.username,
    fullName: user.fullName,
    photo: user.photo,
  };
};

const formatAttachment = (req, attachFile) => {
  if (!attachFile || !attachFile.name) return null;

  return {
    name: attachFile.name,
    size: attachFile.size,
    mimeType: attachFile.mimeType,
    url: getSecureAttachmentUrl(req, attachFile.name),
  };
};

const formatCommentStats = (comment, userId) => {
  return {
    likesCount: comment.likes?.length || 0,
    isLikedByCurrentUser: userId ? comment.likes?.includes(userId) : false,
    repliesCount: comment.replies?.length || 0,
  };
};

const formatCommentObject = (req, comment, includeReplies = false) => {
  if (!comment) return null;

  const result = {
    id: comment._id,
    content: comment.content,
    user: formatUserObject(comment.userId),
    stats: formatCommentStats(comment, req.user?._id),
    createdAt: new Date(comment.createdAt).toLocaleString(),
    attachment: formatAttachment(req, comment.attach_file),
  };

  if (includeReplies && comment.replies) {
    result.replies = comment.replies.map((reply) =>
      formatCommentObject(req, reply)
    );
  }

  return result;
};

const deleteAttachmentFile = async (fileName) => {
  if (!fileName) return;

  const filePath = path.join(attachFileDir, fileName);
  try {
    await fsp.access(filePath);
    await fsp.unlink(filePath);
  } catch (err) {
    console.log(`Could not delete file ${filePath}: ${err.message}`);
  }
};

exports.getAllQuestions = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.answered === "true") {
    filter.verifiedComment = { $exists: true };
  } else if (req.query.answered === "false") {
    filter.verifiedComment = { $exists: false };
  }
  if (req.query.category) {
    filter.category =
      req.query.category == "General" ? null : req.query.category;
  }
  if (req.query.bookmark === "true") {
    filter.bookmarkedBy = req.user._id;
  }
  const total = await Question.countDocuments(filter);

  let questions;
  if (req.query.sort === "-likes") {
    questions = await Question.findAllSortedByLikes(filter, skip, limit);
    questions = await Question.populate(questions, [
      {
        path: "userId",
        select: "username photo fullName role userFrame badges",
      },
      {
        path: "verifiedComment",
        select: "content userId attach_file likes replies",
        populate: [
          {
            path: "userId",
            select: "username photo fullName role userFrame badges",
          },
          {
            path: "replies",
            match: { parentId: { $ne: null } },
            populate: {
              path: "userId",
              select: "username photo fullName role userFrame badges",
            },
          },
        ],
      },
      {
        path: "comments",
        populate: [
          {
            path: "userId",
            select: "username photo fullName role userFrame badges",
          },
          {
            path: "replies",
            match: { parentId: { $ne: null } },
            populate: {
              path: "userId",
              select: "username photo fullName role userFrame badges",
            },
          },
        ],
      },
    ]);
  } else {
    questions = await Question.find(filter)
      .select(
        "content userId likes comments createdAt verifiedComment attach_file bookmarkedBy "
      )
      .populate({
        path: "userId",
        select: "username photo fullName role userFrame badges",
      })
      .populate({
        path: "category",
        select: "courseName",
      })
      .populate({
        path: "verifiedComment",
        select: "content userId attach_file likes replies",
        populate: [
          {
            path: "userId",
            select: "username photo fullName role userFrame badges",
          },
          {
            path: "replies",
            match: { parentId: { $ne: null } },
            populate: {
              path: "userId",
              select: "username photo fullName role userFrame badges",
            },
          },
        ],
      })
      .populate({
        path: "comments",
        populate: [
          {
            path: "userId",
            select: "username photo fullName role userFrame badges",
          },
          {
            path: "replies",
            match: { parentId: { $ne: null } },
            populate: {
              path: "userId",
              select: "username photo fullName role userFrame badges",
            },
          },
        ],
      })
      .sort(req.query.sort ? req.query.sort.split(",").join(" ") : "-createdAt")
      .skip(skip)
      .limit(limit);
  }

  const formattedQuestions = await Promise.all(
    questions.map(async (question) => {
      const questionObj = {
        id: question._id,
        content: question.content,
        user: formatUserObject(question.userId),
        bookmarkedBy: question.bookmarkedBy,
        category: question.category ? question.category.courseName : "General",
        stats: {
          likesCount: question.likes?.length || 0,
          isLikedByCurrentUser: req.user
            ? question.likes?.includes(req.user._id)
            : false,
          bookmarksCount: question.bookmarkedBy.length,
          isbookmarkedByCurrentUser: req.user
            ? question.bookmarkedBy.includes(req.user._id)
            : false,
          commentsCount: question.comments?.length || 0,
        },
        timestamps: {
          created: question.createdAt,
          formatted: new Date(question.createdAt).toLocaleString(),
        },
        attachment: formatAttachment(req, question.attach_file),
      };

      // If there's a verified comment, use it
      if (question.verifiedComment) {
        questionObj.verifiedAnswer = formatCommentObject(
          req,
          question.verifiedComment,
          true
        );
      } else if (question.comments?.length > 0) {
        // If no verified answer, get the top comment
        const sortedComments = question.comments
          .filter((comment) => !comment.parentId) // Only parent comments
          .sort((a, b) => {
            const likesA = a.likes?.length || 0;
            const likesB = b.likes?.length || 0;
            if (likesB !== likesA) {
              return likesB - likesA; // Sort by likes first
            }
            return new Date(b.createdAt) - new Date(a.createdAt); // Then by date
          });

        const topComment = sortedComments[0];
        if (topComment) {
          questionObj.topComment = formatCommentObject(req, topComment);
        }
      }

      return questionObj;
    })
  );

  res.status(200).json({
    status: "success",
    results: questions.length,
    pagination: {
      currentPage: page,
      pages: Math.ceil(total / limit),
    },
    data: {
      questions: formattedQuestions,
    },
  });
});

exports.createQuestion = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const content = req.body.content;
  const category = req.body.category;
  // Create question first
  const questionData = {
    userId: userId,
    content: content,
    category: category,
  };

  if (req.file) {
    questionData.attach_file = {
      name: req.file.filename,
      size: req.file.size,
      mimeType: req.file.mimetype,
      path: req.file.path,
    };
  }

  const newQuestion = await Question.create(questionData);

  // Process mentions after creating question
  await processMentions(content, userId, "question", newQuestion._id);

  await newQuestion.populate({
    path: "userId",
    select: "username fullName photo role userFrame",
  });
  await newQuestion.populate({
    path: "category",
    select: "courseName",
  });
  const response = {
    id: newQuestion._id,
    content: newQuestion.content,
    user: formatUserObject(newQuestion.userId),
    category: newQuestion.category
      ? newQuestion.category.courseName
      : "General",
    attachment: formatAttachment(req, newQuestion.attach_file),
    timestamps: {
      created: newQuestion.createdAt,
      formatted: new Date(newQuestion.createdAt).toLocaleString(),
    },
  };

  await Point.create({
    userId: userId,
    point: 5,
    description: "Created a new question",
  });

  res.status(201).json({
    status: "success",
    data: {
      question: response,
    },
  });

  // Handle notifications in background
  const user = await User.findById(userId).populate("followers");
  const notificationPromises = user.followers.map((follower) => {
    return sendNotificationToUser(
      follower._id,
      NotificationType.QUESTION_FOLLOWING,
      {
        username: user.username,
        questionId: newQuestion._id,
        actingUserId: user._id, // Changed from userId (string) to user._id (ObjectId)
        title: newQuestion.content.substring(0, 50) + "...", // Optional: Add question preview
      }
    );
  });
  // Process notifications in background
  Promise.all(notificationPromises).catch((err) => {
    console.error("Error sending notifications:", err);
  });
});

exports.verifyComment = catchAsync(async (req, res, next) => {
  const question = await Question.findById(req.params.questionId);
  if (!question) {
    return next(new AppError("Question not found", 404));
  }

  // Check if already has verified answer
  if (question.verifiedComment) {
    return next(new AppError("Question already has a verified answer", 400));
  }

  // Check if user is question owner or doctor
  if (
    question.userId.toString() !== req.user._id.toString() &&
    req.user.role !== "instructor" &&
    req.user.role !== "group-leader"
  ) {
    return next(new AppError("You are not authorized to verify answers", 403));
  }

  const comment = await Comment.findOne({
    _id: req.params.commentId,
    questionId: req.params.questionId,
  });

  if (!comment) {
    return next(new AppError("Comment not found", 404));
  }

  question.verifiedComment = comment._id;
  await question.save({ validateBeforeSave: false });

  await Point.create({
    userId: comment.userId,
    point: 10,
    description: "Your comment was verified as the correct answer",
  });

  res.status(200).json({
    status: "success",
    data: { question },
  });

  await sendNotificationToUser(
    comment.userId,
    NotificationType.ANSWER_VERIFIED,
    {
      questionId: question._id,
      actingUserId: req.user._id,
      title: question.content.substring(0, 50) + "...", // Optional: Add question context
    }
  );
});

exports.unverifyComment = catchAsync(async (req, res, next) => {
  const question = await Question.findById(req.params.questionId).populate(
    "verifiedComment"
  );
  if (!question) {
    return next(new AppError("Question not found", 404));
  }

  // Check if user is question owner or doctor
  if (
    question.userId.toString() !== req.user._id.toString() &&
    req.user.role !== "instructor" &&
    req.user.role !== "group-leader"
  ) {
    return next(
      new AppError("You are not authorized to unverify answers", 403)
    );
  }

  // Check if question has verified answer
  if (!question.verifiedComment) {
    return next(new AppError("Question does not have a verified answer", 400));
  }

  if (question.verifiedComment) {
    await Point.create({
      userId: question.verifiedComment.userId,
      point: -10, // Deduct same points given for verification
      description: "Comment unverified as answer",
    });
  }
  question.verifiedComment = null;
  await question.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    message: "Answer unverified successfully",
  });
});

exports.getQuestion = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;
  const sort = req.query.sort || "-createdAt";

  const question = await Question.findById(req.params.id)
    .populate({
      path: "userId",
      select: "username fullName photo role userFrame badges",
    })
    .populate({
      path: "category",
      select: "courseName",
    })
    .populate({
      path: "verifiedComment",
      select: "content userId attach_file createdAt likes",
      populate: [
        {
          path: "userId",
          select: "username fullName photo role userFrame badges",
        },
        {
          path: "replies",
          options: { sort: sort },
          populate: {
            path: "userId",
            select: "username fullName photo role userFrame badges",
          },
        },
      ],
    });

  if (!question) {
    return next(new AppError("Question not found", 404));
  }

  // Handle view tracking
  if (req.user && req.user._id) {
    // Authenticated user - track in viewedBy array
    const alreadyViewed =
      question.viewedBy &&
      question.viewedBy.some((id) => id.toString() === req.user._id.toString());

    if (!alreadyViewed) {
      if (!question.viewedBy) question.viewedBy = [];
      question.viewedBy.push(req.user._id);
      await question.save({ validateBeforeSave: false });
    }
  } else {
    // Anonymous user - increment counter
    question.anonymousViews = (question.anonymousViews || 0) + 1;
    await question.save({ validateBeforeSave: false });
  }

  // Get total comments INCLUDING verified comment
  const totalComments = await Comment.countDocuments({
    questionId: question._id,
    parentId: null, // Only count parent comments
  });

  // Get paginated comments EXCLUDING verified comment
  const comments = await Comment.find({
    questionId: question._id,
    parentId: null, // Only get parent comments
    ...(question.verifiedComment && {
      _id: { $ne: question.verifiedComment._id },
    }),
  })
    .populate({
      path: "userId",
      select: "username fullName photo role userFrame badges",
    })
    .populate({
      path: "replies",
      match: { parentId: { $ne: null } },
      options: { sort: "createdAt" }, // Add sorting here
      populate: {
        path: "userId",
        select: "username fullName photo role userFrame badges",
      },
    })
    .sort("createdAt")
    .skip(skip)
    .limit(limit);

  const formattedQuestion = {
    id: question._id,
    content: question.content,
    user: formatUserObject(question.userId),
    category: question.category ? question.category.courseName : "General",
    stats: {
      likesCount: question.likes.length,
      isLikedByCurrentUser: req.user
        ? question.likes.includes(req.user._id)
        : false,
      bookmarksCount: question.bookmarkedBy.length,
      isbookmarkedByCurrentUser: req.user
        ? question.bookmarkedBy.includes(req.user._id)
        : false,
      commentsCount: totalComments,
      authViews: question.viewedBy ? question.viewedBy.length : 0,
      anonViews: question.anonymousViews || 0,
      totalViews:
        (question.viewedBy ? question.viewedBy.length : 0) +
        (question.anonymousViews || 0),
    },
    timestamps: {
      created: question.createdAt,
      formatted: new Date(question.createdAt).toLocaleString(),
    },
    attachment: formatAttachment(req, question.attach_file),
  };
  if (question.verifiedComment) {
    formattedQuestion.verifiedAnswer = formatCommentObject(
      req,
      question.verifiedComment,
      true
    );
  }

  formattedQuestion.comments = {
    results: comments.length,
    pagination: {
      totalComments: totalComments - (question.verifiedComment ? 1 : 0),
      currentPage: page,
      totalPages: Math.ceil(
        (totalComments - (question.verifiedComment ? 1 : 0)) / limit
      ),
      limit,
    },
    data: comments.map((comment) => formatCommentObject(req, comment, true)),
  };

  res.status(200).json({
    status: "success",
    data: {
      question: formattedQuestion,
    },
  });
});

exports.updateQuestion = catchAsync(async (req, res, next) => {
  const question = await Question.findById(req.params.id);

  if (!question) {
    return next(new AppError("Question not found", 404));
  }

  // Check if user owns the question
  if (question.userId.toString() !== req.user._id.toString()) {
    return next(new AppError("You can only update your own questions", 403));
  }

  // Handle file deletion/replacement
  if (
    (req.file || req.body.remove_file === "true") &&
    question.attach_file &&
    question.attach_file.name
  ) {
    await deleteAttachmentFile(question.attach_file.name);
  }

  // Update question content
  question.content = req.body.content || question.content;

  // Handle file attachment
  if (req.file) {
    question.attach_file = {
      name: req.file.filename,
      size: req.file.size,
      mimeType: req.file.mimetype,
      path: req.file.path,
    };
  } else if (req.body.remove_file === "true") {
    question.attach_file = undefined;
  }

  await question.save();
  await question.populate({
    path: "userId",
    select: "username fullName photo role userFrame",
  });
  await question.populate({
    path: "category",
    select: "courseName",
  });

  const formattedQuestion = {
    id: question._id,
    content: question.content,
    user: formatUserObject(question.userId),
    category: question.category ? question.category.courseName : "General",
    attachment: formatAttachment(req, question.attach_file),
    timestamps: {
      created: question.createdAt,
      updated: question.updatedAt,
    },
  };

  res.status(200).json({
    status: "success",
    data: {
      question: formattedQuestion,
    },
  });
});

exports.deleteQuestion = catchAsync(async (req, res, next) => {
  const question = await Question.findById(req.params.id);

  if (!question) {
    return next(new AppError("Question not found", 404));
  }

  // Check authorization
  if (
    question.userId.toString() !== req.user._id.toString() &&
    req.user.role !== "admin" &&
    req.user.role !== "group-leader"
  ) {
    return next(
      new AppError("You are not authorized to delete this question", 403)
    );
  }

  try {
    // Deduct points from question creator
    await Point.create({
      userId: question.userId,
      point: -5, // Deduct same amount given for creating question
      description: "Question deleted",
    });

    // Delete question's attachment if exists
    if (question.attach_file && question.attach_file.name) {
      await deleteAttachmentFile(question.attach_file.name);
    }

    // Delete all comments' attachments
    const comments = await Comment.find({
      questionId: question._id,
    });

    for (const comment of comments) {
      if (comment.attach_file && comment.attach_file.name) {
        await deleteAttachmentFile(comment.attach_file.name);
      }
    }

    // Delete all comments and replies
    await Comment.deleteMany({ questionId: question._id });

    // Delete the question
    await question.deleteOne();

    res.status(204).json({
      status: "success",
      data: null,
    });
  } catch (error) {
    return next(
      new AppError("Error deleting question and associated data", 500)
    );
  }
});
exports.unbookmarkQuestion = catchAsync(async (req, res, next) => {
  const question = await Question.findByIdAndUpdate(
    req.params.id,
    {
      $pull: { bookmarkedBy: req.user._id },
    },
    { new: true }
  );

  if (!question) {
    return next(new AppError("Question not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      bookmarkBy: question.bookmarkedBy.length,
    },
  });
});
exports.bookmarkQuestion = catchAsync(async (req, res, next) => {
  const question = await Question.findById(req.params.id);

  if (!question) {
    return next(new AppError("Question not found", 404));
  }

  if (question.bookmarkedBy.includes(req.user._id)) {
    return next(new AppError("You already bookmarked this question", 400));
  }

  question.bookmarkedBy.push(req.user._id);
  await question.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    data: {
      bookmarkBy: question.bookmarkedBy.length,
    },
  });
});
// LIKESSSS
exports.likeQuestion = catchAsync(async (req, res, next) => {
  const question = await Question.findById(req.params.id);

  if (!question) {
    return next(new AppError("Question not found", 404));
  }

  // Check if already liked
  if (question.likes.includes(req.user._id)) {
    return next(new AppError("You already liked this question", 400));
  }

  // Add like
  question.likes.push(req.user._id);
  await question.save({ validateBeforeSave: false });

  // Add points if liking someone else's question
  if (question.userId.toString() !== req.user._id.toString()) {
    await Point.create({
      userId: question.userId,
      point: 2,
      description: "Your question received a like",
    });
  }

  await Point.create({
    userId: req.user._id,
    point: 1,
    description: "You liked a question",
  });

  res.status(200).json({
    status: "success",
    data: {
      likes: question.likes.length,
    },
  });

  if (question.userId.toString() !== req.user._id.toString()) {
    await sendNotificationToUser(
      question.userId,
      NotificationType.LIKE_QUESTION,
      {
        username: req.user.username,
        questionId: question._id,
        actingUserId: req.user._id,
        title: question.content.substring(0, 50) + "...", // Optional: Add question context
      }
    );
  }
});

exports.unlikeQuestion = catchAsync(async (req, res, next) => {
  const question = await Question.findById(req.params.id);

  if (!question) {
    return next(new AppError("Question not found", 404));
  }

  // Check if not liked
  if (!question.likes.includes(req.user._id)) {
    return next(new AppError("You have not liked this question", 400));
  }

  // Remove like
  question.likes = question.likes.filter((id) => !id.equals(req.user._id));
  await question.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    data: {
      likes: question.likes.length,
    },
  });
});

exports.getQuestionViewers = catchAsync(async (req, res, next) => {
  const question = await Question.findById(req.params.id);

  if (!question) {
    return next(new AppError("Question not found", 404));
  }

  // Allow all authenticated users to view this information
  if (!req.user) {
    return next(new AppError("Please log in to view this information", 401));
  }

  // Parse pagination parameters
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  // Get total number of authenticated viewers
  const totalViewers = question.viewedBy ? question.viewedBy.length : 0;

  // Get paginated authenticated viewers with their data
  const viewersData = await User.find(
    { _id: { $in: question.viewedBy || [] } },
    "username fullName photo"
  )
    .skip(skip)
    .limit(limit);

  const formattedViewers = viewersData.map((user) =>
    formatSimpleUserObject(user)
  );

  res.status(200).json({
    status: "success",
    data: {
      authenticatedViewers: formattedViewers,
      authenticatedViewsCount: totalViewers,
      anonymousViewsCount: question.anonymousViews || 0,
      totalViews: totalViewers + (question.anonymousViews || 0),
    },
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalViewers / limit),
      limit,
    },
  });
});
