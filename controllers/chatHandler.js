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
      methods: ["GET", "POST", "PATCH", "DELETE"],
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
      let searchQuery;
      const room = socket.handshake.query.course;
      searchQuery = { course: room };
      if (room === "general") {
        searchQuery = { course: { $eq: null } };
      }
      // const course = await Course.findById(room);
      socket.join(room);
      const messages = await Chat.find(searchQuery)
        .limit(20)
        .populate({ path: "sender", select: "username photo" });
      socket.emit("load", messages);
      socket.on("disconnect", () => {
        socket.leave(room);
      });
      socket.on("loadMessages", async (page) => {
        const loadMessages = await Chat.find(searchQuery)
          .skip((page - 1) * 20)
          .limit(20)
          .populate({ path: "sender", select: "username photo" });
        socket.emit("load", loadMessages);
      });
      socket.on("sendMessage", async (Message) => {
        const message = await Chat.create({
          sender: socket.user._id,
          content: Message,
          course: room === "general" ? null : room,
        });
        await message.populate({ path: "sender", select: "username photo" });
        console.log(message);
        io.to(room).emit("receivedMessage", message);
      });
      socket.on("sendReply", async (Message) => {
        console.log(Message);
        const reply = await Chat.create({
          user: socket.user._id,
          content: Message.content,
          course: room === "general" ? null : room,
          replyTo: Message.replyTo,
        });
        await reply.populate({ path: "sender", select: "username photo" });
        io.to(room).emit("receivedMessage", reply);
      });
      socket.on("deleteMessage", async (Message) => {
        const reply = await Chat.findByIdAndDelete(Message._id);
        io.to(room).emit("deletedMessage", reply);
      });
      socket.on("updateMessage", async (Message) => {
        const reply = await Chat.findByIdAndUpdate(Message._id, {
          content: Message.content,
        });
        await reply.populate({ path: "sender", select: "username photo" });
        io.to(room).emit("updatedMessage", reply);
      });
    } catch (err) {
      io.to(socket.io).emit("error", err);
    }
  });
};

module.exports = ioHandler;
