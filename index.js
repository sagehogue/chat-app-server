const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const cors = require("cors");

const { addUser, removeUser, getUser, getUsersInRoom } = require("./users");
const { addMessageToRoom, getMessageHistory } = require("./messages");

const router = require("./router");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// cross-origin-resource-sharing
app.use(cors());
app.use(router);

// Main activity handler
io.on("connect", (socket) => {
  socket.on("join", ({ name, room }, callback) => {
    let messageHistory;
    // Get Messages
    const { error, messages } = getMessageHistory(db, room).then(
      (err, msgs) => {
        // Add user to user list
        const { userError, user } = ({ error, user } = addUser({
          id: socket.id,
          name,
          room,
        }));
        // Msg history is blank/room not found
        if (err) messageHistory = [];
        // Room/messagehistory found
        else messageHistory = msgs;
        // Error occured
        if (userError) return callback(error);
        // Connect user
        socket.join(user.room);
        // Send welcome message to user
        socket.emit("message", {
          user: "admin",
          text: `${user.name}, welcome to room ${user.room}.`,
        });
        // Send messageHistory to user
        socket.emit("messageHistory", messageHistory);
        // Send announcement to room that user has joined.
        socket.broadcast
          .to(user.room)
          .emit("message", { user: "admin", text: `${user.name} has joined!` });
      }
    );

    io.to(user.room).emit("roomData", {
      room: user.room,
      users: getUsersInRoom(user.room),
    });

    callback();
  });

  socket.on("sendMessage", (message, callback) => {
    const user = getUser(socket.id);

    io.to(user.room).emit("message", { user: user.name, text: message });

    callback();
  });

  socket.on("disconnect", () => {
    const user = removeUser(socket.id);

    if (user) {
      io.to(user.room).emit("message", {
        user: "Admin",
        text: `${user.name} has left.`,
      });
      io.to(user.room).emit("roomData", {
        room: user.room,
        users: getUsersInRoom(user.room),
      });
    }
  });
});

server.listen(process.env.PORT || 5000, () =>
  console.log(`Server has started.`)
);
