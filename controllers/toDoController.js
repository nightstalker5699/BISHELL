const User = require("../models/userModel");
const toDoList = require("../models/toDoListModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const factory = require("./handlerFactory");

exports.createItem = catchAsync(async (req, res, next) => {
  const item = await toDoList.create({
    userId: req.user.id,
    task: req.body.task,
    isDone: req.body.isDone,
  });
  res.status(200).json({
    status: "success",
    item,
  });
});

exports.getAllToDoList = factory.getAll(toDoList);
exports.deleteToDoList = factory.deleteOne(toDoList);
exports.updateToDoList = factory.updateOne(toDoList);
exports.getToDoList = factory.getOne(toDoList);
