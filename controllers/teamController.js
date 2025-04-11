const catchAsync = require("./../utils/catchAsync");
const appError = require("./../utils/appError");
const factory = require("./handlerFactory");
const Team = require("../models/teamModel");
const Project = require("../models/projectModel");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const APIFeatures = require("../utils/apiFeatures");
const User = require("../models/userModel");
const Course = require("../models/courseModel");
const { NotificationType } = require("../utils/notificationTypes");
const { fileUploader } = require("../utils/fileUploader");
const { sendNotificationToUser } = require("../utils/notificationUtil");

const dirPath = path.join(__dirname, "..", "uploads", "projectSubmissions");

exports.upload = fileUploader(dirPath, "submission", true);

exports.createTeam = catchAsync(async (req, res, next) => {
  const project = await Project.findById(req.params.projectId);
  if (!project)
    return next(new appError("there is no project with that id ", 404));

  const team = await Team.create({
    members: [req.user._id],
    leader: req.user._id,
    group: req.user.role,
    name: req.body.name,
    maxMember: project.teamMax,
  });

  res.status(200).json({
    message: "success",
    team,
  });
});

exports.getAll = catchAsync(async (req, res, next) => {
  const { projectId } = req.param.projectId;

  let teams = Team.find({ projectId });
  teams = new APIFeatures(teams, req.query)
    .filter()
    .limitFields()
    .paginate()
    .sort();
  teams = await teams.query;
  let inTeam;
  if (req.user.role !== "instructor") {
    inTeam = await Team.find({ members: req.user._id });
  }
  res.status(200).json({
    message: "success",
    data: {
      teams,
      typeOfUser:
        req.user.role == "instructor"
          ? "instructor"
          : !inTeam
          ? "alone"
          : "withTeam",
    },
  });
});

exports.requestToJoin = catchAsync(async (req, res, next) => {
  const team = await Team.findById(req.params.teamId);
  if (!team) return next(new appError("there is no team with that id", 404));

  const project = await Project.findById(req.params.projectId);

  if (!project.crossGroupAllowed && team.group !== req.user.group)
    return next(
      new appError("you can't join a team that in another group"),
      400
    );

  team.requestToJoin.push(req.user._id);
  await team.save();
  res.status(200).json({
    message: "success",
    team,
  });
  const notifData = {
    title: "new request",
    actinguserId: req.user._id,
    courseId: project.courseId,
    projectId: project._id,
    teamId: team._id,
    actinguserName: req.user.username,
  };
  await sendNotificationToUser(
    team.leader,
    NotificationType.REQUESTED_TEAM,
    notifData
  ).catch((err) => {
    console.error("Error sending Notication:", err);
  });
});
