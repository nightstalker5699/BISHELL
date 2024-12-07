const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "a message must have a user"],
    },
    content: {
      type: String,
      required: [true, "a message must have content"],
    },
    course: {
      type: mongoose.Schema.ObjectId,
      ref: "Course",
    },
    replyTo: {
      type: mongoose.Schema.ObjectId,
      ref: "Chat",
    },
  },
  { timestamps: true }
);

const chatModel = mongoose.model("Chat", chatSchema);

module.exports = chatModel;
