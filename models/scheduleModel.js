// scheduleModel.js
const mongoose = require("mongoose");
const scheduleSchema = new mongoose.Schema({
  group: {
    type: String,
    enum: ["A", "B", "C", "D"],
    required: [true, "Schedule must have a group"],
  },
  building: {
    type: String,
    required: [true, "Schedule must have a building"],
  },
  startTime: {
    type: String,
    required: [true, "Schedule must have a start time"],
    validate: {
      validator: function (v) {
        return /^(1[0-2]|0?[1-9])\s?(AM|PM)$/i.test(v);
      },
      message: (props) => `${props.value} is not a valid time format!`,
    },
  },
  endTime: {
    type: String,
    required: [true, "Schedule must have an end time"],
    validate: {
      validator: function (v) {
        return /^(1[0-2]|0?[1-9])\s?(AM|PM)$/i.test(v);
      },
      message: (props) => `${props.value} is not a valid time format!`,
    },
  },
  day: {
    type: String,
    required: [true, "Schedule must have a day"],
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: [true, "Schedule must have a Course"],
  },
});

const Schedule = mongoose.model("Schedule", scheduleSchema);

module.exports = Schedule;