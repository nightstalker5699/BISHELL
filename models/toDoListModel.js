const mongoose = require("mongoose");

const listSchema = mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: [true, "todolist item must have a user"],
  },
  task: String,
  isDone: Boolean,
});

const toDoListModel = mongoose.model("toDoList", listSchema);

module.exports = toDoListModel;
