const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: [true, "a message must have a user"],
  },
  content: {
    type: String,
    required: [true, "a message must have content"],
  },
  sentAt: {
    type: Date,
    default: Date.now(),
  },
  course: {
    type: mongoose.Schema.ObjectId,
    ref: "Course",
  },
});

const chatModel = mongoose.model("Chat", chatSchema);

module.exports = chatModel;
