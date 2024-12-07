const { Server } = require("socket.io");
const User = require("./../models/userModel");
const Course = require("../models/courseModel");
const Chat = require("../models/chatModel");
const catchAsync = require("../utils/catchAsync");
const appError = require("../utils/appError");
const jwt = require("jsonwebtoken");
const { promisify } = require("util");
const errorHandler = require("./errorController");

const ioHandler = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });
  io.use(async (socket, next) => {
    try {
      let token;
      if (socket?.handshake?.auth?.token) {
        token = socket.handshake.auth.token;
      } else {
        throw new appError("there is no token", 403);
      }

      const decoded = await promisify(jwt.verify)(
        token,
        process.env.JWT_SECRET
      );

      const user = await User.findById(decoded.id);
      if (!user) {
        throw new appError(
          "The user belonging to this token does no longer exist.",
          401
        );
      }
      if (user.changedPasswordAfter(decoded.iat))
        throw new appError(
          "your password have been changed. please log in again",
          401
        );

      socket.user = user;
      next();
    } catch (err) {
      const error = errorHandler.socketErrorHandle(err);
      console.log(error);
      next(error);
    }
  }).on("connection", async (socket) => {
    try {
      const room = socket.handshake.query.course;
      const course = await Course.findOne({ slug: room });
      socket.join(room);
      console.log(`${socket.user.username} have joined to room: ${room}`);
      socket.on("disconnect", () => {
        socket.leave(room);
        console.log(`user have left to room: ${room}`);
      });
      socket.on("sendMessage", async (Message) => {
        const message = await Chat.create({
          user: Message.user._id,
          content: Message.content,
          course: course._id,
        });
        io.to(room).emit("receivedMessage", message);
      });
      socket.on("sendReply", async (Message) => {
        const reply = await Chat.create({
          user: Message.user._id,
          content: Message.content,
          course: course._id,
          replyTo: Message.replyTo,
        });
      });
    } catch (err) {
      io.to(socket.io).emit("error", err);
    }
  });
};

module.exports = ioHandler;
