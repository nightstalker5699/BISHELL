const mongoose = require("mongoose");
const postModel = require("./postModel");

const commentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: [true, "a comment must have a user"],
  },
  postId: {
    type: mongoose.Schema.ObjectId,
    ref: "Post",
    required: [true, "a comment must belong to a post"],
  },
  content: {
    type: String,
  },
});

const Comment = mongoose.model("Comment", commentSchema);

module.exports = Comment;
