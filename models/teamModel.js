const mongoose = require("mongoose");
const { validate } = require("./projectModel");

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
  },
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
  projectId: {
    type: mongoose.Schema.ObjectId,
    ref: "Project",
    require: true,
  },
  group: {
    type: String,
    enum: ["A", "B", "C", "D"],
  },
  requestToJoin: [
    {
      type: mongoose.Schema.ObjectId,
      ref: "User",
    },
  ],
});

const teamModel = mongoose.model("projectTeam", teamSchema);

module.exports = teamModel;
