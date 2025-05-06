const express = require("express");
const teamController = require("../controllers/teamController");
const authController = require("../controllers/authController");
const router = express.Router({ mergeParams: true });

router.route("/").get(teamController.getAll).post(teamController.createTeam);
router
  .route("/:teamId/join")
  .patch(teamController.checkLeader, teamController.joinTeam);

router
  .route("/:teamId/edit")
  .patch(teamController.checkLeader, teamController.editTeam);
router
  .route("/:teamId/submit")
  .patch(
    teamController.checkLeader,
    teamController.upload,
    teamController.submitProject
  );
router
  .route("/:teamId")
  .get(teamController.getOne)
  .patch(teamController.requestToJoin);

module.exports = router;
