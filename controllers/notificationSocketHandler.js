const { Server } = require("socket.io");
const User = require("../models/userModel");
const Notification = require("../models/notificationModel");
const catchAsync = require("../utils/catchAsync");
const appError = require("../utils/appError");
const jwt = require("jsonwebtoken");
const { promisify } = require("util");
const errorHandler = require("./errorController");

// Store active connections for direct notification delivery
const activeConnections = new Map(); // userId -> socket

const handleOn = (fn, socket) => (data) => {
  fn(data).catch((err) => {
    console.log("Socket error in handler:", err);
    const error = errorHandler.socketErrorHandle(err);
    socket.emit("error", error);
  });
};

// Authentication middleware
const authenticateSocket = async (socket, next) => {
  try {
    console.log("Authenticating socket connection...");
    let token;
    if (socket?.handshake?.auth?.token) {
      token = socket.handshake.auth.token;
      console.log("Token found in auth");
    } else {
      console.log("No token provided in socket handshake");
      throw new appError("there is no token", 403);
    }

    console.log("Verifying token...");
    const decoded = await promisify(jwt.verify)(
      token,
      process.env.JWT_SECRET
    );
    console.log("Token verified for user ID:", decoded.id);

    const user = await User.findById(decoded.id);
    if (!user) {
      console.log("User not found:", decoded.id);
      throw new appError(
        "The user belonging to this token does no longer exist.",
        401
      );
    }
    
    if (user.changedPasswordAfter && user.changedPasswordAfter(decoded.iat)) {
      console.log("Password changed after token issued");
      throw new appError(
        "your password have been changed. please log in again",
        401
      );
    }
    
    socket.user = user;
    console.log("Authentication successful for user:", user.username || user.email);
    next();
  } catch (err) {
    console.log("Authentication error:", err);
    const error = errorHandler.socketErrorHandle(err);
    next(error);
  }
};

// Initialize notification socket handler
const notificationSocketHandler = (io) => {
  console.log("Initializing notification socket handler");
  
  // Create namespace for notifications
  const notificationIo = io.of('/notifications');
  
  notificationIo.use(authenticateSocket)
    .on("connection", async (socket) => {
      try {
        const userId = socket.user._id.toString();
        console.log(`User ${userId} connected to notification socket`);
        
        // Store user connection for direct notifications
        activeConnections.set(userId, socket);
        
        // Initial load of unread notification count
        const unreadCount = await Notification.countDocuments({
          userId: socket.user._id,
          isRead: false
        });
        
        console.log(`Sending unread count to user ${userId}: ${unreadCount}`);
        socket.emit("unread_count", { count: unreadCount });
        
        // Handle disconnection
        socket.on("disconnect", () => {
          console.log(`User ${userId} disconnected from notification socket`);
          activeConnections.delete(userId);
        });
        
        // Load recent notifications
        socket.on(
          "loadNotifications",
          handleOn(async (page = 1) => {
            console.log(`Loading notifications for user ${userId}, page ${page}`);
            const limit = 10;
            const skip = (page - 1) * limit;
            
            // Find notifications
            const notifications = await Notification.find({ 
              userId: socket.user._id 
            })
              .sort("-createdAt")
              .skip(skip)
              .limit(limit)
              .populate({
                path: 'metadata.actingUserId',
                select: 'username photo fullName userFrame role'
              });
              
            console.log(`Found ${notifications.length} notifications`);
            socket.emit("notifications_loaded", { notifications });
          }, socket)
        );
        
        // Mark notification as read
        socket.on(
          "markAsRead",
          handleOn(async (notificationId) => {
            console.log(`Marking notification ${notificationId} as read for user ${userId}`);
            await Notification.findOneAndUpdate(
              {
                _id: notificationId,
                userId: socket.user._id,
              },
              { isRead: true }
            );
            
            // Get updated count
            const unreadCount = await Notification.countDocuments({
              userId: socket.user._id,
              isRead: false
            });
            
            socket.emit("unread_count", { count: unreadCount });
          }, socket)
        );
        
        // Mark all as read
        socket.on(
          "markAllAsRead",
          handleOn(async () => {
            console.log(`Marking all notifications as read for user ${userId}`);
            await Notification.updateMany(
              { userId: socket.user._id, isRead: false },
              { isRead: true }
            );
            
            socket.emit("unread_count", { count: 0 });
          }, socket)
        );
      } catch (err) {
        console.error("Error in socket connection handler:", err);
        socket.emit("error", { message: "Internal server error", status: "error" });
      }
    });
  
  console.log("Notification socket handler initialized");
  return { notificationIo, activeConnections };
};

// Function to emit a notification to a specific user
const emitNotificationToUser = (userId, notification) => {
  try {
    const userIdStr = userId.toString();
    const socket = activeConnections.get(userIdStr);
    if (socket) {
      console.log(`Emitting notification to user ${userIdStr}`);
      socket.emit("new_notification", { notification });
      
      // Also update the unread count
      Notification.countDocuments({
        userId,
        isRead: false
      }).then(count => {
        socket.emit("unread_count", { count });
      }).catch(err => {
        console.error(`Error getting unread count for user ${userIdStr}:`, err);
      });
    } else {
      console.log(`User ${userIdStr} not connected, skipping real-time notification`);
    }
  } catch (err) {
    console.error("Error emitting notification:", err);
  }
};

module.exports = {
  notificationSocketHandler,
  emitNotificationToUser
};
