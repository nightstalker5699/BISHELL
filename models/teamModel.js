const mongoose = require("mongoose");
const { validate } = require("./projectModel");

const teamSchema = new mongoose.Schema({
  maxMember: {
    type: Number,
    required: true,
  },
  members: [
    {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      validate: {
        validator: function (el) {
          this.members.length + 1 <= this.maxMember;
        },
        message: "team size is lower than team members allowed",
      },
    },
  ],
  leader: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    validate: {
      validator: function (el) {
        return this.members.includes(el);
      },
      message: "leader must be from members",
    },
  },

  submission: {
    name: String,
    size: Number,
    mimeType: String,
    path: String,
  },
});

const teamModel = mongoose.model("projectSubmisson", teamSchema);

module.exports = teamModel;
