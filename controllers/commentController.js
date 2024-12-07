const fs = require('fs').promises;
const catchAsync = require("./../utils/catchAsync");
const AppError = require("./../utils/appError");
const Comment = require("./../models/commentModel");
const Post = require("./../models/postModel");
const factory = require("./handlerFactory");
const Question = require('../models/questionModel')
const path = require('path');

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

  // Check if user owns the comment
  if (comment.userId.toString() !== req.user._id.toString()) {
    return next(new AppError('You can only delete your own comments', 403));
  }

  // Get all replies to this comment
  const replies = await Comment.find({ parentId: comment._id });
  
  // Helper function to delete attachment file
  const deleteAttachment = async (comment) => {
    if (comment.attach_file && comment.attach_file.name) {
      const filePath = path.join(__dirname, '..', 'static', 'attachFile', comment.attach_file.name);
      try {
        await fs.access(filePath); // Check if file exists
        await fs.unlink(filePath); // Delete file
      } catch (err) {
        // File doesn't exist or other error - continue execution
        console.log(`Could not delete file ${filePath}: ${err.message}`);
      }
    }
  };

  try {
    // Delete main comment's attachment
    await deleteAttachment(comment);

    // Delete replies' attachments and the replies themselves
    for (const reply of replies) {
      await deleteAttachment(reply);
      await reply.deleteOne();
    }

    // Remove comment from question's comments array
    await Question.findByIdAndUpdate(req.params.questionId, {
      $pull: { comments: comment._id }
    });

    // Delete the main comment
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

  // Check if already liked
  if (comment.likes.includes(req.user._id)) {
    return next(new AppError('You already liked this comment', 400));
  }

  // Add like
  comment.likes.push(req.user._id);
  await comment.save({ validateBeforeSave: false });

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

  res.status(200).json({
    status: 'success',
    data: {
      likes: comment.likes.length
    }
  });
});