const express = require("express");
const userController = require("../controllers/userController");
const toDoList = require("../models/toDoListModel");
const authController = require("./../controllers/authController");
const toDoListController = require("./../controllers/toDoController");
const router = express.Router();

// routes
router.use(authController.protect);
router
  .route("/")
  .get(authController.restrictTo("admin"), toDoListController.getAllToDoList)
  .post(toDoListController.createItem);
router
  .route("/:id")
  .get(toDoListController.getToDoList)
  .patch(authController.isOwner(toDoList),toDoListController.updateToDoList)
  .delete(authController.isOwner(toDoList),toDoListController.deleteToDoList);
module.exports = router;
