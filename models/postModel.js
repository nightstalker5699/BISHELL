const mongoose = require("mongoose");

const postSchema = mongoose.Schema(
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
  },

  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

postSchema.virtual("likesCount").get(function () {
  return this.likes.length;
});

const postModel = mongoose.model("Post", postSchema);

module.exports = postModel;
