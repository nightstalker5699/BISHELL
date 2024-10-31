const mongoose = require("mongoose");
const Comment = require("./commentModel");
const postSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "post must have user"],
    },
    title: {
      type: String,
      min: 5,
      max: 30,
      required: [true, "post must contain a title"],
    },
    content: {
      type: String,
      required: [true, "post must contain a content"],
    },
    likes: [mongoose.Schema.ObjectId],
    isLiked: Boolean,
    comments: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "Comment",
      },
    ],
  },

  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

postSchema.virtual("likesCount").get(function () {
  return this.likes.length;
});
postSchema.pre("findOneAndDelete", async function (next) {
  this.doc = await this.model.findOne();
  next();
});

postSchema.post("findOneAndDelete", async function (next) {
  await Comment.deleteMany({ postId: this.doc._id });
});
const postModel = mongoose.model("Post", postSchema);
module.exports = postModel;
