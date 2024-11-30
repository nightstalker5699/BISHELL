const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.ObjectId,
    ref: "Course",
    // required: [true, "an announcement must belong to course"],
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
  importance: {
    type: String,
    enum: ["Normal", "Important", "Urgent"],
    required: [true, "An announcement must have a importance type"],
  },
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
  groups: [
    {
      type: String,
    },
  ],
  general: {
    type: Boolean,
    default: true,
  },
},{
  timestamps: true
});

announcementSchema.pre("save", function (next) {
  if (this.courseId) this.general = false;

  next();
});

const Announcement = mongoose.model("Announcement", announcementSchema);

module.exports = Announcement;
