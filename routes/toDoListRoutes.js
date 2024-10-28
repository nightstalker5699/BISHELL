const express = require("express");
const userController = require("../controllers/userController");
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
  .patch(toDoListController.updateToDoList)
  .delete(toDoListController.deleteToDoList);
module.exports = router;
