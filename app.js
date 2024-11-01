const express = require("express");
const morgan = require("morgan");
const AppError = require("./utils/appError");
const globalErrorHandler = require("./controllers/errorController");
const app = express();
const userRouter = require(`${__dirname}/routes/userRoutes.js`);
const pointRouter = require(`${__dirname}/routes/pointRoutes.js`);
const courseRouter = require(`${__dirname}/routes/courseRoutes.js`);
const todoRouter = require(`${__dirname}/routes/toDoListRoutes.js`);
const scheduleRouter = require(`${__dirname}/routes/scheduleRoutes.js`);
const fs = require("fs");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const xss = require("xss-clean");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const cors = require("cors");
const cookieParser = require("cookie-parser");
app.enable("trust proxy");

// Global middlewares
app.use(cors());

app.options("*", cors());

app.use(helmet());

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

const limiter = rateLimit({
  max: 1000,
  windowMs: 60 * 60 * 1000,
  message: "Too many requests from this IP, please try again in an hour!",
});

app.use("api", limiter);


app.use(
  express.json({
    limit: "10kb",
  })
); // Middleware to parse the body of the request
app.use(cookieParser());
app.use(mongoSanitize()); // Middleware to sanitize the input data

app.use(xss()); // Middleware to prevent XSS attacks

app.use(
  hpp({
    whitelist: [],
  })
); // Middleware to prevent parameter pollution

app.use(express.static(`${__dirname}/public`)); // Middleware to serve static files
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

//Middleware mounting
app.use(`/api/users`, userRouter);
app.use(`/api/points`, pointRouter);
app.use(`/api/courses`, courseRouter);
app.use(`/api/todo`, todoRouter);
app.use(`/api/schedules`, scheduleRouter);
app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
