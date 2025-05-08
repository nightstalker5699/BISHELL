const mongoose = require("mongoose");
const slugify = require("slugify");

const noteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "Note must belong to a user"]
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: false
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      minlength: [5, "Title must be at least 5 characters"],
      maxlength: [100, "Title must not exceed 100 characters"]
    },
    contentBlocks: [{
      orderIndex: {
        type: Number,
        required: true
      },
      type: {
        type: String,
        enum: ["text", "image"],
        required: true
      },
      content: {
        type: String,
        required: true
      }
    }],
    likes: [{
      type: mongoose.Schema.ObjectId,
      ref: "User"
    }],
    label: {
      type: String,
      enum: ['Summary', 'Notes', 'Solutions', 'General'],
      required: [true, 'a Note must have a label']
    },
    views: {
      type: Number,
      default: 0
    },
    slug: {
      type: String,
      unique: true,
    },
    comments: [{
      type: mongoose.Schema.ObjectId,
      ref: 'Comment'
    }]
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

noteSchema.index({ userId: 1, slug: 1 }, { unique: true });
noteSchema.index({ userId: 1, createdAt: -1 });
noteSchema.index({ tags: 1 });
noteSchema.index({ status: 1 });
noteSchema.index({ "contentBlocks.orderIndex": 1 });

noteSchema.pre("save", function (next) {
  if (this.isModified("title")) {
    this.slug = slugify(this.title, { lower: true });
  }
  next();
});

const Note = mongoose.model("Note", noteSchema);
module.exports = Note;