const mongoose = require("mongoose");
const dotenv = require(`dotenv`);
dotenv.config({ path: `${__dirname}/config.env` });
process.env.TZ = "Africa/Cairo";
process.on("uncaughtException", (err) => {
  console.log("UNCAUGHT EXCEPTION! Shutting down...", err);
  console.log(err.name, err.message);
  process.exit(1);
});
const chatHandler = require("./controllers/chatHandler");
const { Server } = require("socket.io");
const {
  notificationSocketHandler,
} = require("./controllers/notificationSocketHandler");
const app = require(`./app`);

const DB = process.env.DATABASE.replace(
  `<PASSWORD>`,
  process.env.DATABASE_PASSWORD
);

mongoose.connect(DB).then(() => console.log(`DB connected successfully!`));
const port = process.env.PORT;

const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Create a SINGLE Socket.IO server instance
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
});

// Initialize both socket handlers with the same io instance
// Pass the io instance directly to chatHandler
chatHandler(io);
notificationSocketHandler(io);

process.on("unhandledRejection", (err) => {
  console.log(`UNHANDLED REJECTION! Shutting down...`);
  console.log(err);
  server.close(() => {
    process.exit(1);
  });
});
