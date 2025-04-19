const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    deadline: {
      type: Date,
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    attachedFile: {
      type: String, // Store file URL or path
      required: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the instructor creating the assignment
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "archived", "deleted"],
      default: "active", // Allows you to "archive" or "delete" assignments logically
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  }
);

const Assignment = mongoose.model("Assignment", assignmentSchema);

module.exports = Assignment;
