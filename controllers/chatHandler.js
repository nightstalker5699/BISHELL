const { Server } = require("socket.io");

const ioHandler = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    const room = socket.handshake.query.course;
    socket.join(room);
    console.log(`user have joined to room: ${room}`);
    socket.on("disconnect", () => {
      socket.leave(room);
      console.log(`user have left to room: ${room}`);
    });
    socket.on("sendMessage", (val) => {
      console.log("message");
      io.to(room).emit("receivedMessage", val);
    });
  });
};

module.exports = ioHandler;
