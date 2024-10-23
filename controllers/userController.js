const User = require('../models/userModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require("./handlerFactory")

exports.getAllUsers = factory.getAll(User)
