const User = require("./../models/userModel");
const Course = require("../models/courseModel");
const Chat = require("../models/chatModel");
const catchAsync = require("../utils/catchAsync");
const appError = require("../utils/appError");
const jwt = require("jsonwebtoken");
const { promisify } = require("util");
const errorHandler = require("./errorController");

const handleOn = (fn, socket) => (data) => {
  fn(data).catch((err) => {
    const error = errorHandler.socketErrorHandle(err);
    console.log(error);
    socket.emit("error", error);
  });
};

// Modified to accept an existing io instance instead of creating a new one
const ioHandler = (io) => {
  // Remove the Socket.IO server creation, just use the provided io instance
  
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
    let searchQuery;
    const room = socket.handshake.query.course;
    try {
      if (room === "general") {
        searchQuery = { course: { $eq: null } };
      } else {
        const course = await Course.findOne({ slug: room });
        searchQuery = { course: course._id };
      }
      socket.join(room);
      let messages = await Chat.find(searchQuery)
        .sort("-_id")
        .limit(50)
        .populate({ path: "sender", select: "username photo" })
        .populate({
          path: "replyTo",
          select: "content",
          populate: {
            path: "sender",
            select: "username",
          },
        });
      messages = messages.reverse();
      socket.emit("load", messages);
    } catch (err) {
      io.emit("error", err);
    }
    
    socket.on("disconnect", () => {
      socket.leave(room);
    });
    socket.on(
      "loadMessages",
      handleOn(async (page) => {
        if ((await Chat.countDocuments(searchQuery)) < (page - 1) * 50)
          throw new appError("there is no more messages", 400);
        let loadMessages = await Chat.find(searchQuery)
          .sort("-_id")
          .skip((page - 1) * 50)
          .limit(20)
          .populate({ path: "sender", select: "username photo" })
          .populate({
            path: "replyTo",
            select: "content",
            populate: {
              path: "sender",
              select: "username",
            },
          });
        loadMessages = loadMessages.reverse();
        socket.emit("load", loadMessages);
      }, socket)
    );
    socket.on(
      "sendMessage",
      handleOn(async (Message) => {
        const message = await Chat.create({
          sender: socket.user._id,
          content: Message,
          course: room === "general" ? null : searchQuery.course,
        });
        await message.populate({ path: "sender", select: "username photo" });

        io.to(room).emit("receivedMessage", message);
      }, socket)
    );
    socket.on(
      "sendReply",
      handleOn(async (Message) => {
        console.log(Message);
        let reply = await Chat.create({
          sender: socket.user._id,
          content: Message.content,
          course: room === "general" ? null : searchQuery.course,
          replyTo: Message.replyTo,
        });
        await reply.populate({ path: "sender", select: "username photo" });
        await reply.populate({
          path: "replyTo",
          select: "content",
          populate: {
            path: "sender",
            select: "username",
          },
        });
        io.to(room).emit("receivedMessage", reply);
      }, socket)
    );
    socket.on(
      "deleteMessage",
      handleOn(async (Message) => {
        const reply = await Chat.findByIdAndUpdate(Message, {
          deletedAt: Date.now(),
        });
        io.to(room).emit("deletedMessage", reply);
      }, socket)
    );
    socket.on(
      "updateMessage",
      handleOn(async (Message) => {
        const reply = await Chat.findByIdAndUpdate(
          Message._id,
          {
            content: Message.content,
          },
          { new: true }
        );
        await reply.populate({ path: "sender", select: "username photo" });
        console.log(reply);
        io.to(room).emit("updatedMessage", reply);
      }, socket)
    );
  });
};

module.exports = ioHandler;
