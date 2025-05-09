const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "Post must belong to a user"],
    },
    title: {
      type: String,
      required: [true, "Post must have a title"],
      trim: true,
      maxlength: [100, "Title cannot be more than 100 characters"]
    },
    content: {
      type: String,
    },
    slug: {
      type: String,
      unique: true,
    },
    quillContent: {
      type: Object,
      required: [true, "Post must have Quill content"],
    },
    attachments: [{
      name: String,
      size: Number,
      mimeType: String,
      path: String,
      type: {
        type: String,
        enum: ['image', 'video', 'document', 'other'],
        required: true
      }
    }],
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

// Generate slug from title
postSchema.pre('save', function(next) {
  if (!this.slug) {
    // Extract title and convert it to a URL-friendly slug
    let baseSlug = this.title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-')     // Replace spaces with dashes
      .substring(0, 50);        // Limit length
    
    // Add timestamp to make it unique
    this.slug = `${baseSlug}-${Date.now()}`;
  }
  next();
});

postSchema.virtual("likesCount").get(function () {
  return this.likes.length;
});

postSchema.virtual("viewCount").get(function () {
  const authenticatedViews = this.viewedBy ? this.viewedBy.length : 0;
  const anonViews = this.anonymousViews || 0;
  return authenticatedViews + anonViews;
});

postSchema.index({ createdAt: -1 });
postSchema.index({ likes: 1 });

const Post = mongoose.model("Post", postSchema);
module.exports = Post; 