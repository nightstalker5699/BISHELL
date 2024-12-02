const mongoose = require("mongoose");
const postModel = require("./postModel");

const commentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: [true, "A comment must have a user"]
  },
  questionId: {
    type: mongoose.Schema.ObjectId,
    ref: "Question",
    required: [true, "A comment must belong to a Question"]
  },
  content: {
    type: String,
    required: [true, "A comment cannot be empty"],
    trim: true
  },attach_files:
    {
      name: {
        type: String,
      },
      size: {
        type: Number,
      },
      mimeType: {
        type: String,
      },
      path: {
        type: String,
      },
    },
  likes: [{
    type: mongoose.Schema.ObjectId,
    ref: "User"
  }],
  replies: [{
    type: mongoose.Schema.ObjectId,
    ref: "Comment"
  }]
}, {
  timestamps: true
});

const Comment = mongoose.model("Comment", commentSchema);

module.exports = Comment;