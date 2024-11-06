// postModel.js
const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "Post must belong to a user"]
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
    tags: [String],
    // status: {
    //   type: String,
    //   enum: ["draft", "published", "archived"],
    //   default: "published"
    // },
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