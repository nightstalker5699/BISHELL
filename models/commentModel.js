const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'A comment must have a user'],
    },
    questionId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Question',
      required: [true, 'A comment must belong to a question'],
    },
    content: {
      type: String,
      required: [true, 'A comment cannot be empty'],
      trim: true,
    },
    attach_file: {
      name: String,
      size: Number,
      mimeType: String,
      path: String,
    },
    likes: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],
    parentId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Comment',
      default: null // null means it's a base comment
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

commentSchema.virtual('replies', {
  ref: 'Comment',
  foreignField: 'parentId',
  localField: '_id'
});


const Comment = mongoose.model('Comment', commentSchema);
module.exports = Comment;