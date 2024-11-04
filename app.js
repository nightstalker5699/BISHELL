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
const materialRouter = require("./routes/materialRoutes");
const postRouter = require("./routes/postRoutes");
const fs = require("fs");
const path = require("path");
const rateLimit = require("express-rate-limit");
// const helmet = require("helmet");
const xss = require("xss-clean");
const mongoSanitize = require("express-mongo-sanitize");
// const hpp = require("hpp");
// const cors = require("cors");
const cookieParser = require("cookie-parser");
const multer = require("multer");

app.enable("trust proxy");
const multiPartParser = multer();

// Global middlewares
// app.use(cors());

// app.options("*", cors());

// app.use(helmet());

// if (process.env.NODE_ENV === "development") {
//   app.use(morgan("dev"));
// }

// const limiter = rateLimit({
//   max: 1000,
//   windowMs: 60 * 60 * 1000,
//   message: "Too many requests from this IP, please try again in an hour!",
// });

// app.use("/api", limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(multiPartParser.any()); // To parse multipart/form-data
app.use(cookieParser());
app.use(mongoSanitize()); // Sanitize input data

// app.use(xss()); // Prevent XSS attacks

// app.use(
//   hpp({
//     whitelist: [],
//   })
// ); // Prevent HTTP parameter pollution

app.use(express.static(path.join(__dirname, "static"))); // Serve static files

app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// Route mounting
app.use(`/api/users`, userRouter);
app.use(`/api/points`, pointRouter);
app.use(`/api/courses`, courseRouter);
app.use(`/api/todo`, todoRouter);
app.use("/api/posts", postRouter);
app.use(`/api/schedules`, scheduleRouter);
app.use(`/api/materials`, materialRouter);

app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;