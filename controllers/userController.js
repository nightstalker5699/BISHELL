const User = require('../models/userModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require("./handlerFactory")

exports.getAllUsers = factory.getAll(User)

exports.getMe = (req,res,next) => {
    req.params.id = req.user.id
    next()
  }

  exports.getUser = factory.getOne(User)
  