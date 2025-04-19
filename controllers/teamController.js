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

exports.checkLeader = catchAsync(async (req, res, next) => {
  const team = await Team.findById(req.params.teamId);
  if (!team) return next(new appError("there is no team with that ID", 404));
  if (team.leader.toString() != req.user._id.toString())
    return next(new appError("only the leader can do this action", 400));
  req.team = team;
  next();
});

exports.createTeam = catchAsync(async (req, res, next) => {
  const project = await Project.findById(req.params.projectId);
  if (!project)
    return next(new appError("there is no project with that id ", 404));

  const team = await Team.create({
    members: [req.user._id],
    leader: req.user._id,
    group: req.user.group,
    name: req.body.name,
    maxMember: project.teamMax,
  });

  res.status(200).json({
    message: "success",
    team,
  });
});

exports.getAll = catchAsync(async (req, res, next) => {
  const { projectId } = req.params.projectId;

  let teams = Team.find({ projectId });
  teams = new APIFeatures(teams, req.query)
    .filter()
    .limitFields()
    .paginate()
    .sort();
  teams = await teams.query.populate({
    path: "leader members",
    select: "username photo",
  });
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
exports.getOne = factory.getOne(Team, {
  path: "leader members",
  select: "photo username",
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
  if (team.members.includes(req.user._id))
    return next(
      new appError("you can't request to join a team you already in "),
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

exports.editTeam = catchAsync(async (req, res, next) => {
  const userId = req.body.userId;
  const team = req.team;
  if (!team.members.includes(userId))
    return next(new appError("you do not have a member with that name", 404));

  if (req.body.type != "remove") {
    team.leader = userId;
  } else {
    team.members = team.members.filter((userid) => {
      return userid != userId;
    });
  }
  await team.save();

  res.status(200).json({
    message: "success",
    team,
  });

  if (req.body.type === "remove") {
    const notifData = {
      title: "You Got removed From a Team",
      actinguserId: req.user._id,
      courseId: req.params.courseId,
      projectId: req.params.projectId,
      teamId: team._id,
      actinguserName: req.user.username,
      teamName: team.name,
    };
    await sendNotificationToUser(
      userId,
      NotificationType.REMOVED_FROM_TEAM,
      notifData
    ).catch((err) => {
      console.error("Error sending Notication:", err);
    });
  }
});

exports.joinTeam = catchAsync(async (req, res, next) => {
  const team = req.team;
  const userId = req.body.userId;
  const project = await Project.findById(req.params.projectId);
  if (!team.members.includes(userId) && team.requestToJoin.includes(userId))
    team.requestToJoin = team.requestToJoin.filter((userId) => {
      return userId != userId;
    });
  team.members.push(userId);

  await team.save();
  res.status(200).json({
    message: "success",
    team,
  });
  const notifData = {
    title: "You Joined a Team",
    courseId: project.courseId,
    projectId: project._id,
    teamId: team._id,
    teamName: team.name,
  };
  await sendNotificationToUser(
    userId,
    NotificationType.JOINED_TEAM,
    notifData
  ).catch((err) => {
    console.error("Error sending Notication:", err);
  });
});

exports.submitProject = catchAsync(async (req, res, next) => {
  if (!req.file) return next(new appError("you must insert a file", 400));
  const team = req.team;
  if (team.submission.name) {
    fs.unlinkSync(path.join(dirPath, team.submission.name));
  }
  const file = req.file;
  let data = {
    name: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
    path: `/uploads/projectSubmissions/${file.originalname}`,
  };
  team.submission = data;
  await team.save();
  res.status(200).json({
    message: "success",
    team,
  });
});
exports.leaveTeam = catchAsync(async (req, res, next) => {
  const team = await Team.findById(req.params.teamId);
  if (!team) return next(new appError("There is no team with that ID", 404));
  if (team.leader == req.user._id)
    return next(
      new appError("you can leave before assigning a new leader", 400)
    );

  team.members = team.members.filter((userId) => {
    return userId != req.user._id;
  });
  await team.save();

  res.status.json({
    message: "success",
    team,
  });
});
