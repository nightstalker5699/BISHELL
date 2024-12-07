const mongoose = require("mongoose");

const assigmentSchema = new mongoose.Schema({
  instructor: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: true,
  },
  course: {
    type: mongoose.Schema.ObjectId,
    ref: "Course",
    required: true,
  },
  group: [String],
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  deadline: {
    type: Date,
    required: true,
  },
  file: {
    type: String,
    required: true,
  },
});

const assigmentModel = mongoose.model("Assigment", assigmentSchema);

module.exports = assigmentModel;
