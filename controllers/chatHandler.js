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
      if (room === "general") {
        searchQuery = { course: { $eq: null } };
      } else {
        const course = await Course.findOne({ slug: room });
        searchQuery = { course: course._id };
      }
      socket.join(room);
      let messages = await Chat.find(searchQuery)
        .sort("-_id")
        .limit(20)
        .populate({ path: "sender", select: "username photo" });
      messages = messages.reverse();
      socket.emit("load", messages);
      socket.on("disconnect", () => {
        socket.leave(room);
      });
      socket.on("loadMessages", async (page) => {
        let loadMessages = await Chat.find(searchQuery)
          .sort("-_id")
          .skip((page - 1) * 20)
          .limit(20)
          .populate({ path: "sender", select: "username photo" });
        loadMessages = loadMessages.reverse();
        socket.emit("load", loadMessages);
      });
      socket.on("sendMessage", async (Message) => {
        const message = await Chat.create({
          sender: socket.user._id,
          content: Message,
          course: room === "general" ? null : searchQuery.course,
        });
        await message.populate({ path: "sender", select: "username photo" });

        io.to(room).emit("receivedMessage", message);
      });
      socket.on("sendReply", async (Message) => {
        const reply = await Chat.create({
          user: socket.user._id,
          content: Message.content,
          course: room === "general" ? null : searchQuery.course,
          replyTo: Message.replyTo,
        });
        await reply.populate({ path: "sender", select: "username photo" });
        io.to(room).emit("receivedMessage", reply);
      });
      socket.on("deleteMessage", async (Message) => {
        const reply = await Chat.findByIdAndUpdate(Message, {
          deletedAt: Date.now(),
        });
        io.emit("deletedMessage", reply);
        io.to(room).emit("deletedMessage", reply);
      });
      socket.on("updateMessage", async (Message) => {
        const reply = await Chat.findByIdAndUpdate(Message._id, {
          content: Message.content,
        });
        await reply.populate({ path: "sender", select: "username photo" });
        io.to(room).emit("updatedMessage", reply);
        io.emit("updatedMessage", reply);
      });
    } catch (err) {
      io.to(socket.io).emit("error", err);
    }
  });
};

module.exports = ioHandler;
