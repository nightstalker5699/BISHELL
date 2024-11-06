const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.ObjectId,
    ref: "Course",
    required: [true, "an announcement must belong to course"],
  },
  announcerId: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: [true, "an announcement must belong to a user"],
  },
  title: {
    type: String,
    required: [true, "an announcement must have a title"],
  },
  body: { type: String, required: [true, "an announcement must have a body"] },
  attach_files: [
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
  ],
});

const Announcement = mongoose.model("Announcement", announcementSchema);

module.exports = Announcement;
