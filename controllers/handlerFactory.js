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

  exports.getAll = (Model) => catchAsync(async (req, res, next) => {

  
    const doc = await Model.find()
    // Send the Response
    res.status(200).json({
      status: 'success',
      requestedAt: req.requestTime,
      results: doc.length,
      data: {
        doc: doc,
      },
    });
  });