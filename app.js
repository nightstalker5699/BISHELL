const express = require("express");

const app = express();
const path = require("path");
const fs = require("fs");
const morgan = require("morgan");
const helmet = require("helmet");
const cors = require("cors");
const cookie = require("cookie-parser");
// MUST MIDDLEWARES
app.enable("trust proxy");
// FOR SHARING DATA WITH OTHER WEBSITES
app.use(cors());
// FOR ALLOWING COMPLEX REQUESTS
app.options("*", cors());
// FOR IMG ACCESSING
app.use(express.static(path.join(__dirname, "static")));
// DEFENSE HEADERS
app.use(helmet());
// DEV LOGGING
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// app.use(errorhandler)

module.exports = app;
