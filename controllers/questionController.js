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
const { NotificationType } = require('../utils/notificationTypes');
const { processMentions } = require('../utils/mentionUtil');
const { getSecureAttachmentUrl } = require('../utils/urlUtils');

const attachFileDir = path.join(__dirname, "..", "static", "attachFile");
if (!fs.existsSync(attachFileDir)) {
  fs.mkdirSync(attachFileDir, { recursive: true });
}

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

  const total = await Question.countDocuments(filter);

  let questions;
  if (req.query.sort === "-likes") {
    questions = await Question.findAllSortedByLikes(filter, skip, limit);
    questions = await Question.populate(questions, [
      {
        path: "userId",
        select: "username photo fullName role userFrame",
      },
      {
        path: "verifiedComment",
        select: "content userId attach_file likes replies",
        populate: [
          {
            path: "userId",
            select: "username photo fullName role userFrame",
          },
          {
            path: "replies",
            match: { parentId: { $ne: null } },
          },
        ],
      },
      {
        path: "comments",
        populate: [
          {
            path: "userId",
            select: "username photo fullName role userFrame",
          },
          {
            path: "replies",
            match: { parentId: { $ne: null } },
          },
        ],
      },
    ]);
  } else {
    questions = await Question.find(filter)
      .select(
        "content userId likes comments createdAt verifiedComment attach_file"
      )
      .populate({
        path: "userId",
        select: "username photo fullName role userFrame",
      })
      .populate({
        path: "verifiedComment",
        select: "content userId attach_file likes replies",
        populate: [
          {
            path: "userId",
            select: "username photo fullName role userFrame",
          },
          {
            path: "replies",
            match: { parentId: { $ne: null } },
          },
        ],
      })
      .populate({
        path: "comments",
        populate: [
          {
            path: "userId",
            select: "username photo fullName role userFrame",
          },
          {
            path: "replies",
            match: { parentId: { $ne: null } },
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
        user: {
          username: question.userId.username,
          fullName: question.userId.fullName,
          photo: question.userId.photo,
          role: question.userId.role,
          userFrame: question.userId.userFrame,
        },
        stats: {
          likesCount: question.likes?.length || 0,
          isLikedByCurrentUser: req.user
            ? question.likes?.includes(req.user._id)
            : false,
          commentsCount: question.comments?.length || 0,
        },
        timestamps: {
          created: question.createdAt,
          formatted: new Date(question.createdAt).toLocaleString(),
        },
        attachment:
          question.attach_file && question.attach_file.name
            ? {
                name: question.attach_file.name,
                size: question.attach_file.size,
                mimeType: question.attach_file.mimeType,
                url: getSecureAttachmentUrl(req, question.attach_file.name),
              }
            : null,
      };

      // If there's a verified comment, use it
      if (question.verifiedComment) {
        questionObj.verifiedAnswer = {
          id: question.verifiedComment._id,
          content: question.verifiedComment.content,
          user: {
            username: question.verifiedComment.userId?.username,
            fullName: question.verifiedComment.userId?.fullName,
            photo: question.verifiedComment.userId?.photo,
            userFrame: question.verifiedComment.userId?.userFrame,
          },
          stats: {
            likesCount: question.verifiedComment.likes?.length || 0,
            isLikedByCurrentUser: req.user
              ? question.verifiedComment.likes?.includes(req.user._id)
              : false,
            repliesCount: question.verifiedComment.replies?.length || 0,
          },
        };

        if (question.verifiedComment.attach_file?.name) {
          questionObj.verifiedAnswer.attachment = {
            name: question.verifiedComment.attach_file.name,
            size: question.verifiedComment.attach_file.size,
            mimeType: question.verifiedComment.attach_file.mimeType,
            url: getSecureAttachmentUrl(req, question.verifiedComment.attach_file.name),
          };
        } else {
          questionObj.verifiedAnswer.attachment = null;
        }
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
          questionObj.topComment = {
            id: topComment._id,
            content: topComment.content,
            user: {
              username: topComment.userId?.username,
              fullName: topComment.userId?.fullName,
              photo: topComment.userId?.photo,
              userFrame: topComment.userId?.userFrame,
            },
            stats: {
              likesCount: topComment.likes?.length || 0,
              isLikedByCurrentUser: req.user
                ? topComment.likes?.includes(req.user._id)
                : false,
              repliesCount: topComment.replies?.length || 0,
            },
          };

          if (topComment.attach_file?.name) {
            questionObj.topComment.attachment = {
              name: topComment.attach_file.name,
              size: topComment.attach_file.size,
              mimeType: topComment.attach_file.mimeType,
              url: getSecureAttachmentUrl(req, topComment.attach_file.name),
            };
          } else {
            questionObj.topComment.attachment = null;
          }
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

  // Create question first
  const questionData = {
    userId: userId,
    content: content
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
  await processMentions(
    content, 
    userId,
    'question',
    newQuestion._id
  );

  await newQuestion.populate({
    path: "userId",
    select: "username fullName photo role userFrame",
  });

  const response = {
    id: newQuestion._id,
    content: newQuestion.content,
    user: {
      username: newQuestion.userId.username,
      fullName: newQuestion.userId.fullName,
      photo: newQuestion.userId.photo,
      userFrame: newQuestion.userId.userFrame,
    },
    attachment:
      newQuestion.attach_file && newQuestion.attach_file.name
        ? {
            name: newQuestion.attach_file.name,
            size: newQuestion.attach_file.size,
            mimeType: newQuestion.attach_file.mimeType,
            url: getSecureAttachmentUrl(req, newQuestion.attach_file.name),
          }
        : null,
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
        title: newQuestion.content.substring(0, 50) + '...' // Optional: Add question preview
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
      title: question.content.substring(0, 50) + '...' // Optional: Add question context
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

  // Deduct points from comment owner

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
      select: "username fullName photo role userFrame",
    })
    .populate({
      path: "verifiedComment",
      select: "content userId attach_file createdAt likes",
      populate: [
        {
          path: "userId",
          select: "username fullName photo role userFrame",
        },
        {
          path: "replies",
          options: { sort: sort },
          populate: {
            path: "userId",
            select: "username fullName photo role userFrame",
          },
        },
      ],
    });

  if (!question) {
    return next(new AppError("Question not found", 404));
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
      select: "username fullName photo role userFrame",
    })
    .populate({
      path: "replies",
      match: { parentId: { $ne: null } },
      options: { sort: "createdAt" }, // Add sorting here
      populate: {
        path: "userId",
        select: "username fullName photo role userFrame",
      },
    })
    .sort("createdAt")
    .skip(skip)
    .limit(limit);
  const formattedQuestion = {
    id: question._id,
    content: question.content,
    user: {
      username: question.userId.username,
      fullName: question.userId.fullName,
      photo: question.userId.photo,
      role: question.userId.role,
      userFrame: question.userId.userFrame,
    },
    stats: {
      likesCount: question.likes.length,
      isLikedByCurrentUser: req.user
        ? question.likes.includes(req.user._id)
        : false,
      commentsCount: totalComments,
    },
    timestamps: {
      created: question.createdAt,
      formatted: new Date(question.createdAt).toLocaleString(),
    },
  };

  if (question.attach_file && question.attach_file.name) {
    formattedQuestion.attachment = {
      name: question.attach_file.name,
      size: question.attach_file.size,
      mimeType: question.attach_file.mimeType,
      url: getSecureAttachmentUrl(req, question.attach_file.name),
    };
  }

  if (question.verifiedComment) {
    formattedQuestion.verifiedAnswer = {
      id: question.verifiedComment._id,
      content: question.verifiedComment.content,
      user: {
        username: question.verifiedComment.userId.username,
        fullName: question.verifiedComment.userId.fullName,
        photo: question.verifiedComment.userId.photo,
        role: question.verifiedComment.userId.role,
        userFrame: question.verifiedComment.userId.userFrame,
      },
      stats: {
        likesCount: question.verifiedComment.likes.length,
        isLikedByCurrentUser: req.user
          ? question.verifiedComment.likes.includes(req.user._id)
          : false,
      },
      createdAt: new Date(question.verifiedComment.createdAt).toLocaleString(),
      replies: question.verifiedComment.replies?.map((reply) => ({
        id: reply._id,
        content: reply.content,
        user: {
          username: reply.userId.username,
          fullName: reply.userId.fullName,
          photo: reply.userId.photo,
          role: reply.userId.role,
          userFrame: reply.userId.userFrame,
        },
        stats: {
          likesCount: reply.likes.length,
          isLikedByCurrentUser: req.user
            ? reply.likes.includes(req.user._id)
            : false,
        },
        createdAt: new Date(reply.createdAt).toLocaleString(),
        attachment:
          reply.attach_file && reply.attach_file.name
            ? {
                name: reply.attach_file.name,
                size: reply.attach_file.size,
                mimeType: reply.attach_file.mimeType,
                url: getSecureAttachmentUrl(req, reply.attach_file.name),
              }
            : null,
      })),
    };

    if (
      question.verifiedComment.attach_file &&
      question.verifiedComment.attach_file.name
    ) {
      formattedQuestion.verifiedAnswer.attachment = {
        name: question.verifiedComment.attach_file.name,
        size: question.verifiedComment.attach_file.size,
        mimeType: question.verifiedComment.attach_file.mimeType,
        url: getSecureAttachmentUrl(req, question.verifiedComment.attach_file.name),
      };
    }
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
    data: comments.map((comment) => ({
      id: comment._id,
      content: comment.content,
      user: {
        username: comment.userId.username,
        fullName: comment.userId.fullName,
        photo: comment.userId.photo,
        role: comment.userId.role,
        userFrame: comment.userId.userFrame,
      },
      stats: {
        likesCount: comment.likes.length,
        isLikedByCurrentUser: req.user
          ? comment.likes.includes(req.user._id)
          : false,
      },
      createdAt: new Date(comment.createdAt).toLocaleString(),
      attachment:
        comment.attach_file && comment.attach_file.name
          ? {
              name: comment.attach_file.name,
              size: comment.attach_file.size,
              mimeType: comment.attach_file.mimeType,
              url: getSecureAttachmentUrl(req, comment.attach_file.name),
            }
          : null,
      replies: comment.replies?.map((reply) => ({
        id: reply._id,
        content: reply.content,
        user: {
          username: reply.userId.username,
          fullName: reply.userId.fullName,
          photo: reply.userId.photo,
          role: reply.userId.role,
          userFrame: reply.userId.userFrame,
        },
        stats: {
          likesCount: reply.likes.length,
          isLikedByCurrentUser: req.user
            ? reply.likes.includes(req.user._id)
            : false,
        },
        createdAt: new Date(reply.createdAt).toLocaleString(),
        attachment:
          reply.attach_file && reply.attach_file.name
            ? {
                name: reply.attach_file.name,
                size: reply.attach_file.size,
                mimeType: reply.attach_file.mimeType,
                url: getSecureAttachmentUrl(req, reply.attach_file.name),
              }
            : null,
      })),
    })),
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
    const oldFilePath = path.join(
      __dirname,
      "..",
      "static",
      "attachFile",
      question.attach_file.name
    );
    try {
      await fsp.access(oldFilePath);
      await fsp.unlink(oldFilePath);
    } catch (err) {
      console.log(`Could not delete old file ${oldFilePath}: ${err.message}`);
    }
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

  const formattedQuestion = {
    id: question._id,
    content: question.content,
    user: {
      username: question.userId.username,
      fullName: question.userId.fullName,
      photo: question.userId.photo,
      role: question.userId.role,
      userFrame: question.userId.userFrame,
    },
    attachment:
      question.attach_file && question.attach_file.name
        ? {
            name: question.attach_file.name,
            size: question.attach_file.size,
            mimeType: question.attach_file.mimeType,
            url: getSecureAttachmentUrl(req, question.attach_file.name),
          }
        : null,
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

  const deleteAttachment = async (filePath) => {
    try {
      await fsp.access(filePath);
      await fsp.unlink(filePath);
    } catch (err) {
      console.log(`Could not delete file ${filePath}: ${err.message}`);
    }
  };

  try {
    // Deduct points from question creator
    await Point.create({
      userId: question.userId,
      point: -5, // Deduct same amount given for creating question
      description: "Question deleted",
    });

    // Delete question's attachment if exists
    if (question.attach_file && question.attach_file.name) {
      const questionFilePath = path.join(
        __dirname,
        "..",
        "static",
        "attachFile",
        question.attach_file.name
      );
      await deleteAttachment(questionFilePath);
    }

    // Delete all comments' attachments
    const comments = await Comment.find({
      questionId: question._id,
    });

    for (const comment of comments) {
      if (comment.attach_file && comment.attach_file.name) {
        const commentFilePath = path.join(
          __dirname,
          "..",
          "static",
          "attachFile",
          comment.attach_file.name
        );
        await deleteAttachment(commentFilePath);
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
// protection On deleting Question for points done
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
        title: question.content.substring(0, 50) + '...' // Optional: Add question context
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
