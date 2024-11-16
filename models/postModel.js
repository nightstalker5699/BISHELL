const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "Post must belong to a user"]
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
      required: [true, 'a Post must have a label']
    },
    views: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

postSchema.index({ userId: 1, createdAt: -1 });
postSchema.index({ tags: 1 });
postSchema.index({ status: 1 });
postSchema.index({ "contentBlocks.orderIndex": 1 });

postSchema.virtual("comments", {
  ref: "Comment",
  foreignField: "postId",
  localField: "_id"
});

const Post = mongoose.model("Post", postSchema);
module.exports = Post;