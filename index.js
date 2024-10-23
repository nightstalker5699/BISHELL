process.on("uncaughtException", (err) => {
  console.log("uncaught exception: shutting downing...");
  console.log(err.name, err.message);
  process.exit(1);
});

const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: "./config.env" });

const app = require("./app");

const DB = process.env.DATABASE;

mongoose
  .connect(DB, {
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("database is running");
  });
const port = process.env.PORT || 8000;
const server = app.listen(port, () => {
  console.log(`server is running on ${port}`);
});

process.on("unhandledRejection", (err) => {
  console.log(err.name, err.message);
  console.log("unhandled Rejection: shutting downing...");
  server.close(() => {
    process.exit(1);
  });
});
