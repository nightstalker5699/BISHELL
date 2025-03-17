const mongoose = require("mongoose");

const badgeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "A badge must have a name"],
    unique: true,
  },
  description: {
    type: String,
    required: [true, "A badge must have a description"],
  },
  icon: {
    type: String,
    default: "default_badge.png",
  },
  criteria: {
    type: String,
    required: [true, "A badge must have criteria for earning it"],
  },
  rank: {
    type: String,
    enum: ["bronze", "silver", "gold", "mighty"],
    required: [true, "A badge must have a rank"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Badge = mongoose.model("Badge", badgeSchema);

module.exports = Badge;
