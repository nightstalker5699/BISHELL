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
const { NotificationType } = require('../utils/notificationTypes');
const { processMentions } = require('../utils/mentionUtil');
const { getAIExplanation, getBotUserId } = require('../utils/aiAssistant');

// Helper function to check if comment contains an AI command
const containsAICommand = (content) => {
  return content.toLowerCase().includes('/ai');
};

// Function to handle AI reply for a comment
const processAIRequest = async (comment, question, req) => {
  try {
    // Get the comment content where the /ai command was used
    const commentContent = comment.content;
    
    // Get question content for context
    const questionContent = question.content;
    
    // Get AI explanation using both the comment content and question content
    const aiResponse = await getAIExplanation(questionContent, commentContent);
    
    // Create a reply with the AI response using the bot's account
    const botUserId = getBotUserId();
    
    const reply = await Comment.create({
      userId: botUserId, // Use bot's account instead of the user's account
      questionId: question._id,
      content: `${aiResponse}`,
      parentId: comment._id
    });
    
    await reply.populate('userId', 'username fullName photo userFrame badges');
    
    // Send notification to comment author
    await sendNotificationToUser(
      comment.userId,
      NotificationType.AI_EXPLANATION,
      {
        questionId: question._id,
        commentId: reply._id
      }
    );
    
    return reply;
  } catch (error) {
    console.error('Error processing AI request:', error);
    return null;
  }
};

exports.addComment = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.questionId);
  
  if (!post) return next(new AppError("there is no post with that ID", 404));
  
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
    .populate('userId', 'username fullName photo userFrame badges')
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

  // Process mentions after creating comment - UPDATED contentType to 'question-comment'
  await processMentions(
    req.body.content,
    req.user._id,
    'question-comment',  // Changed from 'comment' to 'question-comment'
    comment._id,
    req.params.questionId // Pass question ID for proper linking
  );

  // Add comment to question's comments array
  question.comments.push(comment._id);
  await question.save({ validateBeforeSave: false });

  await comment.populate('userId', 'username fullName photo userFrame badges');

  const response = {
    _id: comment._id,
    content: comment.content,
    user: {
      _id: comment.userId._id,
      username: comment.userId.username,
      fullName: comment.userId.fullName,
      userFrame: comment.userId.userFrame,
      badges: comment.userId.badges
    },
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

  // Check if the comment contains an AI command
  let aiReply = null;
  if (containsAICommand(req.body.content)) {
    aiReply = await processAIRequest(comment, question, req);
  }

  if (question.userId.toString() !== req.user._id.toString()) {
    await sendNotificationToUser(
      question.userId,
      NotificationType.COMMENT_ON_QUESTION,
      {
        username: req.user.username,
        questionId: question._id,
        commentId: comment._id,
        actingUserId: req.user._id,
        title: question.content.substring(0, 50) + '...' // Add question context
      }
    );
  }

  const responseData = { comment: response };
  
  // If AI generated a response, include it in the response
  if (aiReply) {
    responseData.aiReply = {
      id: aiReply._id,
      content: aiReply.content,
      user: {
        username: aiReply.userId.username,
        fullName: aiReply.userId.fullName,
        photo: aiReply.userId.photo,
        userFrame: aiReply.userId.userFrame,
        badges: aiReply.userId.badges
      },
      parentId: aiReply.parentId,
      createdAt: aiReply.createdAt,
      attachment: null
    };
  }

  res.status(201).json({
    status: 'success',
    data: responseData
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
  await comment.populate('userId', 'username fullName photo userFrame badges');

  // Process mentions for updated content - UPDATED contentType logic
  await processMentions(
    req.body.content,
    req.user._id,
    comment.parentId ? 'reply' : 'question-comment',  // Use correct template key
    comment._id,
    req.params.questionId  // Pass question ID for proper linking
  );

  const response = {
    id: comment._id,
    content: comment.content,
    user: {
      username: comment.userId.username,
      fullName: comment.userId.fullName,
      photo: comment.userId.photo,
      userFrame: comment.userId.userFrame,
      badges: comment.userId.badges
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
    questionId: req.params.questionId,  // This is the question ID
    content: req.body.content,
    parentId: parentComment._id,
    attach_file: req.file ? {
      name: req.file.filename,
      size: req.file.size,
      mimeType: req.file.mimetype,
      path: req.file.path,
    } : undefined
  });

  // Pass the question ID correctly here
  await processMentions(
    req.body.content,
    req.user._id,
    'reply',  // This one is already correct
    reply._id,
    req.params.questionId  // Pass the question ID from params
  );

  await reply.populate('userId', 'username fullName photo userFrame badges');

  const response = {
    id: reply._id,
    content: reply.content,
    user: {
      username: reply.userId.username,
      fullName: reply.userId.fullName,
      photo: reply.userId.photo,
      userFrame: reply.userId.userFrame,
      badges: reply.userId.badges
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

  // Check if the user is replying to their own comment
  const isOwnComment = parentComment.userId.toString() === req.user._id.toString();
  
  // Check if the user has already replied to this comment
  const existingReplies = await Comment.find({
    parentId: parentComment._id,
    userId: req.user._id
  });
  
  // Only give points if it's not their own comment and it's their first reply
  if (!isOwnComment && existingReplies.length <= 1) {
    await Point.create({
      userId: req.user._id,
      point: 1,
      description: "Posted a reply to a comment"
    });
  }

  // Check if reply contains AI command
  let aiReply = null;
  if (containsAICommand(req.body.content)) {
    // Get the question to provide context to AI
    const question = await Question.findById(req.params.questionId);
    if (question) {
      aiReply = await processAIRequest(reply, question, req);
    }
  }

  const responseData = { reply: response };

  // If AI generated a response, include it in the response
  if (aiReply) {
    responseData.aiReply = {
      id: aiReply._id,
      content: aiReply.content,
      user: {
        username: aiReply.userId.username,
        fullName: aiReply.userId.fullName,
        photo: aiReply.userId.photo,
        userFrame: aiReply.userId.userFrame,
        badges: aiReply.userId.badges
      },
      parentId: aiReply.parentId,
      createdAt: aiReply.createdAt,
      attachment: null
    };
  }

  res.status(201).json({
    status: 'success',
    data: responseData
  });

  // Handle notifications in background
  if (parentComment.userId.toString() !== req.user._id.toString()) {
    await sendNotificationToUser(
      parentComment.userId,
      NotificationType.COMMENT_REPLIED,
      {
        username: req.user.username,
        questionId: req.params.questionId,
        commentId: reply._id,
        actingUserId: req.user._id,
        title: parentComment.content.substring(0, 50) + '...' // Add comment context
      }
    );
  }
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

  // Check if already liked
  if (comment.likes.includes(req.user._id)) {
    return next(new AppError('You already liked this comment', 400));
  }

  // Add like
  comment.likes.push(req.user._id);
  await comment.save({ validateBeforeSave: false });

  // Determine if this is a main comment or a reply
  const isReply = comment.parentId !== null && comment.parentId !== undefined;
  
  // Check if user is liking their own content
  const isOwnContent = comment.userId.toString() === req.user._id.toString();
  
  if (!isOwnContent) {
    // Liked someone else's comment or reply
    await Point.create({
      userId: comment.userId,
      point: 2,
      description: "Your comment/reply received a like"
    });
    
    // Only give points to the liker when liking someone else's content
    await Point.create({
      userId: req.user._id,
      point: 1, 
      description: "You liked someone's comment"
    });
  } else if (!isReply) {
    // User liked their own main comment (not a reply)
    await Point.create({
      userId: comment.userId, 
      point: 2,
      description: "Your comment received a like"
    });
    
    // Give points to user for liking their own main comment
    await Point.create({
      userId: req.user._id,
      point: 1, 
      description: "You liked your own comment"
    });
  }
  // Note: No points given when liking your own reply (neither for receiving nor for giving the like)

  // Send response first
  res.status(200).json({
    status: 'success',
    data: {
      likes: comment.likes.length
    }
  });

  // Send notification to the comment owner if it's not their own comment
  if (!isOwnContent) {
    await sendNotificationToUser(
      comment.userId,
      NotificationType.COMMENT_LIKED,
      {
        username: req.user.username,
        questionId: req.params.questionId,
        commentId: comment._id,
        actingUserId: req.user._id,
        title: comment.content.substring(0, 50) + '...' // Add comment context
      }
    );
  }
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