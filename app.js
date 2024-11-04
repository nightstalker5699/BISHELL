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
const helmet = require("helmet");
const xss = require("xss-clean");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const multer = require("multer");

app.enable("trust proxy");
const multiPartParser = multer();

// Configure CORS options
const corsOptions = {
  origin: ['https://bis-hell.vercel.app'], // Frontend URL
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Disposition'],
  maxAge: 600,
};

// Global middlewares
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Create profilePics directory if it doesn't exist
const profilePicsDir = path.join(__dirname, 'static', 'profilePics');
if (!fs.existsSync(profilePicsDir)) {
  fs.mkdirSync(profilePicsDir, { recursive: true });
}

// Serve static files
app.use(express.static(path.join(__dirname, 'static')));
app.use('/profilePics', cors(corsOptions), express.static(profilePicsDir));

// Set security HTTP headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:', '*'],
      },
    },
  })
);

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

const limiter = rateLimit({
  max: 1000,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!',
});

app.use('/api', limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(multiPartParser.any());
app.use(cookieParser());
app.use(mongoSanitize());
app.use(xss());
app.use(
  hpp({
    whitelist: [],
  })
);

app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// Mounting routes
app.use('/api/users', userRouter);
app.use('/api/points', pointRouter);
app.use('/api/courses', courseRouter);
app.use('/api/todo', todoRouter);
app.use('/api/posts', postRouter);
app.use('/api/schedules', scheduleRouter);
app.use('/api/materials', materialRouter);

app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;