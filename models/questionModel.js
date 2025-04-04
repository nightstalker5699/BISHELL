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
    category: {
      type: mongoose.Schema.ObjectId,
      ref: "Course",
    },
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
  limit,
  userId // Add userId parameter
) {
  return this.aggregate([
    { $match: filter },
    {
      $addFields: {
        likesCount: { $size: "$likes" },
        bookmarkedBy: { $ifNull: ["$bookmarkedBy", []] },
        // Add a field to check if current user has liked the question
        isLikedByCurrentUser: userId ? {
          $in: [userId, "$likes"]
        } : false
      },
    },

    {
      $project: {
        content: 1,
        userId: 1,
        attach_file: 1,
        likes: 1,
        comments: 1,
        verifiedComment: 1,
        createdAt: 1,
        updatedAt: 1,
        bookmarkedBy: 1,
        viewedBy: 1,
        anonymousViews: 1,
        likesCount: 1,
        isLikedByCurrentUser: 1,
      },
    },
    { $sort: { likesCount: -1 } },
    { $skip: skip },
    { $limit: limit },
  ]);
};

const Question = mongoose.model("Question", questionSchema);
module.exports = Question;
