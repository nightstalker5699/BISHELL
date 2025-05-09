const express = require("express");
const morgan = require("morgan");
const AppError = require("./utils/appError");
const globalErrorHandler = require("./controllers/errorController");
const app = express();
const userRouter = require(`./routes/userRoutes.js`);
const pointRouter = require(`./routes/pointRoutes.js`);
const courseRouter = require(`./routes/courseRoutes.js`);
const todoRouter = require(`./routes/toDoListRoutes.js`);
const scheduleRouter = require(`./routes/scheduleRoutes.js`);
const materialRouter = require("./routes/materialRoutes");
const noteRouter = require("./routes/noteRoutes");
const questionRouter = require("./routes/questionRoutes");
const notificationRouter = require("./routes/notificationRoutes");
const badgesRouter = require("./routes/badgeRoutes");
const storeRouter = require("./routes/storeRoutes.js");

const assignmentRoutes = require("./routes/assignmentRoutes.js");
const submissionRoutes = require("./routes/submissionRoutes.js");
require("./cronJobs/deadlineReminder");
const postRouter = require('./routes/postRoutes');
const fs = require("fs");
const path = require("path");
const rateLimit = require("express-rate-limit");
// const helmet = require("helmet");
// const xss = require("xss-clean");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const cors = require("cors");
// const compression = require('compression');
const cookieParser = require("cookie-parser");

app.enable("trust proxy");

// 1) Security headers
// app.use(helmet());

// 2) CORS configuration
app.use(
  cors({
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: "*",
    credentials: true,
  })
);

app.options("*", cors());

// 3) Development logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// 4) Request limiting
const limiter = rateLimit({
  max: 1000,
  windowMs: 60 * 60 * 1000,
  message: "Too many requests from this IP, please try again in an hour!",
});

// app.use("/api", limiter);

// 5) Body parsers
app.use(express.json({ limit: "1000mb" }));
app.use(express.urlencoded({ extended: true, limit: "1000mb" }));
app.use(cookieParser());

// 6) Security middleware
app.use(mongoSanitize());
// app.use(xss());
// app.use(hpp());

// 7) Static files
const staticPath = path.join(__dirname, "static");
console.log(`Setting up static file serving from: ${staticPath}`);
app.use('/static', express.static(staticPath));

// Additional middleware to log static file requests
app.use('/static', (req, res, next) => {
  const requestedFile = path.join(staticPath, req.path);
  if (!fs.existsSync(requestedFile)) {
    console.log(`File not found: ${requestedFile}`);
  }
  next();
});

// 8) Custom headers
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});

// 9) Request timestamp
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// 11) Routes
app.get("/preview", require("./controllers/authController.js").previewUser);
app.use(`/api/materials`, materialRouter);
app.use(`/api/users`, userRouter);
app.use(`/api/points`, pointRouter);
app.use(`/api/courses`, courseRouter);
app.use(`/api/todo`, todoRouter);
app.use("/api/notes", noteRouter);
app.use(`/api/schedules`, scheduleRouter);
app.use(`/api/questions`, questionRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/badges", badgesRouter);
app.use("/api/store", storeRouter);
app.use('/api/posts', postRouter);
// 11) Error handling
// 12) Error handling

app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler.globalErrorHandle);

module.exports = app;
