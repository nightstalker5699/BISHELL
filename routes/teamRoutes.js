const express = require("express");
const teamController = require("../controllers/teamController");

const router = express.Router({ mergeParams: true });

router.route("/").get(teamController.getAll).post(teamController.createTeam);

module.exports = router;
