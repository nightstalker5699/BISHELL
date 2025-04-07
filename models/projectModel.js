const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    teamMin: {
      type: Number,
      default: 0,
    },
    teamMax: {
      type: Number,
      required: true,
    },
    courseId: {
      type: mongoose.Schema.ObjectId,
      ref: "Course",
      required: true,
    },
    crossGroupAllowed: {
      type: Boolean,
      default: true,
    },
    attach_file: {
      name: String,
      size: Number,
      mimeType: String,
      path: String,
    },
    dueDate: {
      type: Date,
      required: true,
      validate: {
        validator: function (el) {
          return this.dueDate > new Date(Date.now());
        },
        message: "the due date must be after few days atleast",
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const projectModel = mongoose.model("Project", projectSchema);

module.exports = projectModel;
