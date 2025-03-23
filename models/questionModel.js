const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "Question must belong to a user"],
    },
    content: {
      type: String,
      required: [true, "Question must have content"],
    },
    attach_file: {
      name: String,
      size: Number,
      mimeType: String,
      path: String,
    },
    likes: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "User",
      },
    ],
    comments: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "Comment",
      },
    ],
    verifiedComment: {
      type: mongoose.Schema.ObjectId,
      ref: "Comment",
    },
    viewedBy: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "User",
      },
    ],
    anonymousViews: {
      type: Number,
      default: 0,
    },
    bookmarkedBy: [mongoose.Schema.ObjectId],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

questionSchema.virtual("likesCount").get(function () {
  return this.likes.length;
});

questionSchema.virtual("viewCount").get(function () {
  const authenticatedViews = this.viewedBy ? this.viewedBy.length : 0;
  const anonViews = this.anonymousViews || 0;
  return authenticatedViews + anonViews;
});

questionSchema.index({ createdAt: -1 });
questionSchema.index({ likes: 1 });

questionSchema.statics.findAllSortedByLikes = async function (
  filter,
  skip,
  limit
) {
  return this.aggregate([
    { $match: filter },
    {
      $addFields: {
        likesCount: { $size: "$likes" },
      },
    },
    { $sort: { likesCount: -1 } },
    { $skip: skip },
    { $limit: limit },
  ]);
};

const Question = mongoose.model("Question", questionSchema);
module.exports = Question;
