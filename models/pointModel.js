const mongoose = require("mongoose");
const User = require("./userModel");
const catchAsync = require("../utils/catchAsync");
const logSchema = mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: [true, "log must belong to a user"],
  },
  point: {
    type: Number,
    required: [true, "log must have to a point"],
  },
  description: {
    type: String,
    required: [true, "log must have a description"],
  },
});

logSchema.statics.calcuPoints = async function (userId) {
  const totalPoints = await this.aggregate([
    { $match: { userId: userId } },
    { $group: { _id: userId, points: { $sum: "$point" } } },
  ]);
  await User.updateOne(
    { _id: userId },
    {
      points: totalPoints[0].points,
    }
  );
};

logSchema.post("save", function () {
  this.constructor.calcuPoints(this.userId);
});

logSchema.pre(/^findOneAnd/, async function (next) {
  // create a field that have the document after deleteing it
  this.r = await this.model.findOne();
  next();
});

logSchema.post(/^findOneAnd/, async function () {
  // executing the query methods
  await this.r.constructor.calcuPoints(this.r.userId);
});
const logModel = mongoose.model("logPoints", logSchema);

module.exports = logModel;
