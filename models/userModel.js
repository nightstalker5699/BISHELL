const crypto = require("crypto");
const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "A user must have a username"],
      unique: true,
      validate: {
        validator: function (v) {
          return /^[a-zA-Z0-9-]+$/.test(v);
        },
        message:
          "Username can only contain letters, numbers, and hyphens (-), no spaces.",
      },
    },
    deviceTokens: {
      type: [String],
    },
    fullName: {
      type: String,
      required: [true, "A user must have a fullName"],
    },
    email: {
      type: String,
      required: [true, "A user must have an email"],
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, "Please provide a valid email"],
    },
    photo: {
      type: String,
      default: "default.jpg",
    },
    userFrame: {
      type: String,
      default: "null",
    },
    caption: {
      type: String,
      required: [false],
      default: "This user is too lazy for writing couple of words 🙄",
    },
    role: {
      type: String,
      enum: ["student", "instructor", "group-leader", "admin"],
      default: "student",
    },
    group: {
      type: String,
      enum: ["A", "B", "C", "D"],
      required: [true, "A user must be in a group"],
    },
    badges: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Badge",
      },
    ],
    recentNotes: {
      type: [String],
      default: [],
    },
    password: {
      type: String,
      required: [true, "A user must have a password"],
      minlength: 6,
      select: false,
    },
    passwordConfirm: {
      type: String,
      required: [true, "A user must confirm the password"],
      validate: {
        validator: function (el) {
          return el === this.password;
        },
        message: "Passwords are not the same",
      },
    },
    passwordChangedAt: {
      type: Date,
    },
    passwordResetToken: String,
    passwordResetTokenExpires: Date,
    points: {
      type: Number,
      default: 0,
    },
    rank: {
      type: Number,
    },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    showToDo: {
      type: Boolean,
      default: true,
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    stats: {
      coins: {
        type: Number,
        default: 0,
      },
      questionCount: {
        type: Number,
        default: 0,
      },
      likesCount: {
        type: Number,
        default: 0,
      },
      solvedCount: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userSchema.index({ rank: 1 });

userSchema.virtual("toDoList", {
  ref: "toDoList",
  foreignField: "userId",
  localField: "_id",
});
userSchema.virtual("Posts", {
  ref: "Post",
  foreignField: "userId",
  localField: "_id",
});
userSchema.pre("save", async function (next) {
  // Only run this function if password was actually modified
  if (!this.isModified("password")) return next();

  // hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);
  // delete the confirm field
  this.passwordConfirm = undefined;
  next();
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || this.isNew) return next();
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.pre(/^find/, function (next) {
  this.populate({
    path: "badges",
    select: "name icon",
  });
  next();
});

userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTIMESTAMP) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTIMESTAMP < changedTimestamp;
  }
  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  console.log({ resetToken }, this.passwordResetToken);
  this.passwordResetTokenExpires = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

userSchema.post("updateOne", async function () {
  const users = await this.model.find({ role: "student" }).sort({ points: -1 });
  await Promise.all(
    users.map((user, index) => {
      user.rank = index + 1;
      return user.save({ validateBeforeSave: false });
    })
  );
});

const User = mongoose.model("User", userSchema);

module.exports = User;
