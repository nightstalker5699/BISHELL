const catchAsync = require("../utils/catchAsync");
const AppError = require("./../utils/appError");

exports.createOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.create(req.body);
    res.status(201).json({
      status: "success",
      data: {
        data: doc,
      },
    });
  });

exports.updateOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!doc) {
      return next(new AppError(`There's no document with this ID`, 404));
    }

    res.status(200).json({
      status: "success",
      data: {
        data: doc,
      },
    });
  });

exports.deleteOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.findByIdAndDelete(req.params.id);

    if (!doc) {
      return next(new AppError(`There's no docs with this ID`, 404));
    }

    res.status(204).json({
      status: "success",
      data: null,
    });
  });

  exports.getAll = (Model, excludeFields = []) =>
    catchAsync(async (req, res, next) => {
      // Convert the array of fields to exclude into a string format for Mongoose select
      const excludeString = excludeFields.map(field => `-${field}`).join(' ');
  
      const doc = await Model.find().select(excludeString);
  
      // Send the Response
      res.status(200).json({
        status: "success",
        requestedAt: req.requestTime,
        results: doc.length,
        data: {
          doc: doc,
        },
      });
    });

exports.getOne = (Model, populateOptions) =>
  catchAsync(async (req, res, next) => {
    let query = Model.findOne({ username: req.params.username }).select(
      "-passwordResetToken -passwordResetTokenExpires -passwordChangedAt"
    );
    if (Model.modelname === "User" || req.user.username === req.params.username)
      query = query.populate("toDoList");
    if (populateOptions) query = query.populate(populateOptions);
    const doc = await query;

    if (!doc) {
      return next(new AppError(`There's no document with this username`, 404));
    }
    res.status(200).json({
      status: "success",
      data: {
        data: doc,
      },
    });
  });
