const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Question must belong to a user'],
    },
    content: {
      type: String,
      required: [true, 'Question must have content'],
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
    comments: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'Comment',
      },
    ],
    verifiedComment: {
      type: mongoose.Schema.ObjectId,
      ref: 'Comment',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);



const Question = mongoose.model('Question', questionSchema);
module.exports = Question;