const fs = require('fs').promises;
const catchAsync = require("./../utils/catchAsync");
const AppError = require("./../utils/appError");
const Comment = require("./../models/commentModel");
const Post = require("./../models/postModel");
const factory = require("./handlerFactory");
const Question = require('../models/questionModel')
const path = require('path');
const Point = require("../models/pointModel");
const { sendNotificationToUser } = require('../utils/notificationUtil');



exports.addComment = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.questionId);
  
  if (!post) return next(new appError("there is no post with that ID", 404));
  
  const comment = await Comment.create({
    userId: req.user._id,
    content: req.body.content,
    questionId: req.params.questionId,
  });


  if (!post.comments) {
    post.comments = [];
  }
  
  post.comments.push(comment._id);
  await post.save();

  res.status(200).json({
    status: "success",
    data: {
      comment,
      user: {
        username: req.user.username,
        photo: req.user.photo,
      },
    },
  });
});

exports.updateComment = factory.updateOne(Comment);
exports.deleteComment = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.questionId);
  if (!post) return next(new appError("there is no post with that ID", 404));
  await Comment.findByIdAndDelete(req.params.id);
  post.comments = post.comments.filter(
    (comment) => comment.toString() !== req.params.id
  );
  await post.save();
  res.status(204).json({
    status: "success",
  });
});

exports.getAllComments = catchAsync(async (req, res, next) => {
  const comments = await Comment.find({ questionId: req.params.questionId })
    .populate('userId', 'username fullName photo')
    .sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: comments.length,
    data: { comments }
  });
});

exports.addQuestionComment = catchAsync(async (req, res, next) => {
  const question = await Question.findById(req.params.questionId);
  if (!question) {
    return next(new AppError('Question not found', 404));
  }

  // Create comment
  const comment = await Comment.create({
    userId: req.user._id,
    questionId: req.params.questionId,
    content: req.body.content,
    attach_file: req.file ? {
      name: req.file.filename,
      size: req.file.size,
      mimeType: req.file.mimetype,
      path: req.file.path,
    } : undefined,
    likes: [], // Initialize empty arrays
    replies: []
  });

  // Add comment to question's comments array
  question.comments.push(comment._id);
  await question.save({ validateBeforeSave: false });

  await comment.populate('userId', 'username fullName photo');

  const response = {
    _id: comment._id,
    content: comment.content,
    user: {
      _id: comment.userId._id,
      username: comment.userId.username,
      fullName: comment.userId.fullName,
      photo: comment.userId.photo
    },
    questionId: comment.questionId,
    attachment: comment.attach_file && comment.attach_file.name ? {
      name: comment.attach_file.name,
      size: comment.attach_file.size,
      mimeType: comment.attach_file.mimeType,
      url: `${req.protocol}://${req.get('host')}/static/attachFile/${comment.attach_file.name}`
    } : null,
    timestamps: {
      created: comment.createdAt,
      formatted: new Date(comment.createdAt).toLocaleString()
    }
  };

  await Point.create({
    userId: req.user._id,
    point: 1,
    description: "Posted a comment on a question"
  });

  res.status(201).json({
    status: 'success',
    data: { comment: response }
  });
});


exports.updateQuestionComment = catchAsync(async (req, res, next) => {
  const comment = await Comment.findOne({
    _id: req.params.commentId,
    questionId: req.params.questionId
  });

  if (!comment) {
    return next(new AppError('Comment not found', 404));
  }

  // Check if user owns the comment
  if (comment.userId.toString() !== req.user._id.toString()) {
    return next(new AppError('You can only edit your own comments', 403));
  }

  // Update only the content
  comment.content = req.body.content;
  await comment.save();
  await comment.populate('userId', 'username fullName photo');

  const response = {
    id: comment._id,
    content: comment.content,
    user: {
      username: comment.userId.username,
      fullName: comment.userId.fullName,
      photo: comment.userId.photo
    },
    attachment: comment.attach_file && comment.attach_file.name ? {
      name: comment.attach_file.name,
      size: comment.attach_file.size,
      mimeType: comment.attach_file.mimeType,
      url: `${req.protocol}://${req.get('host')}/static/attachFile/${comment.attach_file.name}`
    } : null,
    timestamps: {
      created: comment.createdAt,
      updated: comment.updatedAt
    }
  };

  res.status(200).json({
    status: 'success',
    data: { comment: response }
  });
});

exports.addReply = catchAsync(async (req, res, next) => {
  const parentComment = await Comment.findById(req.params.commentId);
  
  if (!parentComment) {
    return next(new AppError('Comment not found', 404));
  }

  if (parentComment.parentId) {
    return next(new AppError('Cannot reply to a reply', 400));
  }

  const reply = await Comment.create({
    userId: req.user._id,
    questionId: req.params.questionId,
    content: req.body.content,
    parentId: parentComment._id,
    attach_file: req.file ? {
      name: req.file.filename,
      size: req.file.size,
      mimeType: req.file.mimetype,
      path: req.file.path,
    } : undefined
  });

  await reply.populate('userId', 'username fullName photo');

  const response = {
    id: reply._id,
    content: reply.content,
    user: {
      username: reply.userId.username,
      fullName: reply.userId.fullName,
      photo: reply.userId.photo
    },
    parentId: reply.parentId,
    createdAt: reply.createdAt,
    attachment: reply.attach_file && reply.attach_file.name ? {
      name: reply.attach_file.name,
      size: reply.attach_file.size,
      mimeType: reply.attach_file.mimeType,
      url: `${req.protocol}://${req.get('host')}/static/attachFile/${reply.attach_file.name}`
    } : null
  };

  await Point.create({
    userId: req.user._id,
    point: 1,
    description: "Posted a reply to a comment"
  });

  // Send notification to the comment owner
  const messageData = {
    title: 'Your Comment was Replied',
    body: `${req.user.username} replied to your comment.`,
    click_action: `/questions/${req.params.questionId}#comment-${parentComment._id}`,
  };
  await sendNotificationToUser(parentComment.userId, messageData);


  res.status(201).json({
    status: 'success',
    data: { reply: response }
  });
});


exports.deleteQuestionComment = catchAsync(async (req, res, next) => {
  const comment = await Comment.findOne({
    _id: req.params.commentId,
    questionId: req.params.questionId
  });

  if (!comment) {
    return next(new AppError('Comment not found', 404));
  }

  if (comment.userId.toString() !== req.user._id.toString()) {
    return next(new AppError('You can only delete your own comments', 403));
  }

  const replies = await Comment.find({ parentId: comment._id });
  
  const deleteAttachment = async (comment) => {
    if (comment.attach_file && comment.attach_file.name) {
      const filePath = path.join(__dirname, '..', 'static', 'attachFile', comment.attach_file.name);
      try {
        await fs.access(filePath);
        await fs.unlink(filePath);
      } catch (err) {
        console.log(`Could not delete file ${filePath}: ${err.message}`);
      }
    }
  };

  try {
    // Deduct points for main comment deletion
    await Point.create({
      userId: comment.userId,
      point: -1,
      description: "Comment deleted"
    });

    await deleteAttachment(comment);

    for (const reply of replies) {
      await deleteAttachment(reply);
      await reply.deleteOne();
    }

    await Question.findByIdAndUpdate(req.params.questionId, {
      $pull: { comments: comment._id }
    });

    await comment.deleteOne();

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    return next(new AppError('Error deleting comment and associated data', 500));
  }
});

exports.likeComment = catchAsync(async (req, res, next) => {
  const comment = await Comment.findOne({
    _id: req.params.commentId,
    questionId: req.params.questionId
  });

  if (!comment) {
    return next(new AppError('Comment not found', 404));
  }

  // if (comment.userId.toString() === req.user._id.toString()) {
  //   return next(new AppError('You cannot like your own comment', 400));
  // }

  // Check if already liked
  if (comment.likes.includes(req.user._id)) {
    return next(new AppError('You already liked this comment', 400));
  }

  // Add like
  comment.likes.push(req.user._id);
  await comment.save({ validateBeforeSave: false });

  // Check if user is liking their own comment
  if (comment.userId.toString() !== req.user._id.toString()) {
    // Liked someone else's comment
    await Point.create({
      userId: comment.userId,
      point: 2,
      description: "Your comment/reply received a like"
    });
  }


  await Point.create({
    userId: req.user._id,  // liker gets the points
    point: 1, 
    description: "You liked someone's comment"
});

// Send notification to the comment owner
  if (comment.userId.toString() !== req.user._id.toString()) {
    const messageData = {
      title: 'Your Comment was Liked',
      body: `${req.user.username} liked your comment.`,
      click_action: `/questions/${req.params.questionId}`,
    };
    await sendNotificationToUser(comment.userId, messageData);
  }
  res.status(200).json({
    status: 'success',
    data: {
      likes: comment.likes.length
    }
  });
});

exports.unlikeComment = catchAsync(async (req, res, next) => {
  const comment = await Comment.findOne({
    _id: req.params.commentId,
    questionId: req.params.questionId
  });

  if (!comment) {
    return next(new AppError('Comment not found', 404));
  }

  // Check if not liked
  if (!comment.likes.includes(req.user._id)) {
    return next(new AppError('You have not liked this comment', 400));
  }

  // Remove like
  comment.likes = comment.likes.filter(id => !id.equals(req.user._id));
  await comment.save({ validateBeforeSave: false });

  await Point.create({
    userId: comment.userId,
    point: -2, // Deduct points from comment owner
    description: "Comment/reply lost a like"
  });

  await Point.create({
    userId: req.user._id,
    point: -1, // Deduct point from user who unliked
    description: "Unliked a comment"
  });

  res.status(200).json({
    status: 'success',
    data: {
      likes: comment.likes.length
    }
  });
});

// protection on comments and likes