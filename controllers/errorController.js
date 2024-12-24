const AppError = require("../utils/appError");

const handleCastErrorDB = (err) => {
  const message = `invalid ${err.path}:${err.value}`;
  return new AppError(message, 400);
};
const handleDupFieldsDB = (err) => {
  const message = `Duplicate field value: ${
    JSON.stringify(err.keyValue).split(":")[1]
  }. please use another value`;
  return new AppError(message, 400);
};
const handleDupEmail = () => {
  const message = `this email is already signed up before use different one please`;
  return new AppError(message, 400);
};
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid input data. ${errors.join(". ")}`;
  return new AppError(message, 400);
};
const handleJWTError = () =>
  new AppError("invalid token. please log in again", 401);
const handleJWTExpiredError = () =>
  new AppError("your token has expired. please log in again", 401);
const sendErrorDev = (err, req, res) => {
  // API //
  console.log(err);
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
  });
};

const sendErrorProd = (err, req, res) => {
  // API //
  //operational and trusted error:send message to client
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }
  //Programming or unknow error: don't leak erro details
  //1) Log error
  console.log("ERROR:", err);
  //2) send general error
  return res.status(500).json({
    status: "error",
    message: "something went wrong",
  });
};

exports.globalErrorHandle = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(err, req, res);
  } else if (process.env.NODE_ENV === "production") {
    let error = { ...err };
    error.message = err.message;
    if (err.name === "CastError") error = handleCastErrorDB(error);
    if (err.code === 11000) error = handleDupFieldsDB(error);
    if (err.name === "ValidationError") error = handleValidationErrorDB(error);
    if (err.name === "JsonWebTokenError") error = handleJWTError();
    if (err.name === "TokenExpiredError") error = handleJWTExpiredError();
    if (err.name === "MongoError" && err.keyValue.email)
      error = handleDupEmail();
    sendErrorProd(error, req, res);
  }
};

exports.socketErrorHandle = (err) => {
  let error = { ...err };
  error.message = err.message;
  if (err.name === "CastError") error = handleCastErrorDB(error);
  if (err.code === 11000) error = handleDupFieldsDB(error);
  if (err.name === "ValidationError") error = handleValidationErrorDB(error);
  if (err.name === "JsonWebTokenError") error = handleJWTError();
  if (err.name === "TokenExpiredError") error = handleJWTExpiredError();
  return {
    message: error.message,
    status: error.status,
    statusCode: error.statusCode,
  };
};
