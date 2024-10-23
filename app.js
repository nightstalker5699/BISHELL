const express = require('express');
const morgan = require('morgan');
const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const app = express();
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');


// Global middlewares

app.use(helmet());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

const limiter = rateLimit({
  max: 1000,
  windowMs: 60 * 60 * 1000,
  message: "Too many requests from this IP, please try again in an hour!",
});

app.use('api', limiter);


app.use(express.json({
  limit: '10kb'
})); // Middleware to parse the body of the request

app.use(mongoSanitize()); // Middleware to sanitize the input data

app.use(xss()); // Middleware to prevent XSS attacks

app.use(hpp({
  whitelist: []
})); // Middleware to prevent parameter pollution

app.use(express.static(`${__dirname}/public`)); // Middleware to serve static files
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

//Middleware mounting
//app.use(`/api/v1/users`, userRouter);


app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
