const mongoose = require("mongoose");
const User = require("./userModel");
const StoreSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "store item must have name"],
    },
    URL: {
      type: String,
      required: [true, "store item must have URL"],
      unique: true,
    },
    owners: [mongoose.Schema.ObjectId],
    price: {
      type: Number,
      required: [true, "store item must have Price"],
    },
    currency: {
      type: String,
      required: [true, "store item must have Currency"],
      Enum: ["coins", "likesCount", "QuestionCount", "SolvedCount"],
    },
  },
  { toObject: { virtuals: true } }
);

StoreSchema.pre(/^findOneAnd/, async function (next) {
  const doc = await this.model.findOne().select("URL");
  this.oldURL = doc.URL;
});

StoreSchema.post(/^findOneAnd/, async function () {
  const updates = this.getUpdate();
  await User.updateMany(
    { userFrame: this.oldURL },
    { userFrame: updates ? updates["$set"].URL : "" }
  );
});

const StoreModel = mongoose.model("Store", StoreSchema);

module.exports = StoreModel;
