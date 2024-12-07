const express = require("express");
const assigmentController = require("../controllers/assigmentController");
const authController = require("../controllers/authController");

const router = express.Router({
  mergeParams: true,
});

router
  .route("/")
  .post(
    authController.restrictTo("instructor"),
    assigmentController.assigment,
    assigmentController.createAssigment
  );

module.exports = router;
