const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const cors = require("cors");
admin = require("firebase-admin");

const { addUser, removeUser, getUser, getUsersInRoom } = require("./users");
const { addMessageToRoom, getMessageHistory } = require("./messages");

const router = require("./router");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Initializing firebase

const serviceAccount = require("./API_KEY.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://chat-app-c2d82.firebaseio.com"
});

app.use(cors());
app.use(router);
const myObj = { hey: "that" };
myObj.hey;

db = admin.firestore();
const roomsRef = db.collection("rooms");
const testRef = roomsRef.doc("test");

// This is how to log all data from a collection

let getDoc = roomsRef
  .get()
  .then(col => {
    col.forEach(doc => {
      if (!doc.exists) {
        console.log("No such document!");
      } else {
        console.log(`Document Name: ${doc.id}\n`, "Document data:", doc.data());
      }
    });
  })
  .catch(err => {
    console.log("Error getting document", err);
  });

// socket.io event listenerss

io.on("connect", socket => {
  socket.on("join", ({ name, room }, callback) => {
    let messageHistory;
    // Get Messages
    const returnMessages = getMessageHistory(db, room).then((err, msgs) => {
      // Add user to user list
      const { error, user } = addUser({
        id: socket.id,
        name,
        room
      });
      // Msg history is blank/room not found
      if (err) messageHistory = [];
      // Room/messagehistory found
      else messageHistory = msgs;
      // Error occured
      if (error) return callback(error);
      // Connect user
      socket.join(user.room);
      // Send welcome message to user
      socket.emit("message", {
        user: "admin",
        text: `${user.name}, welcome to room ${user.room}.`
      });
      // Send messageHistory to user
      socket.emit("messageHistory", messageHistory);
      // Send announcement to room that user has joined.
      socket.broadcast
        .to(user.room)
        .emit("message", { user: "admin", text: `${user.name} has joined!` });
    });
    io.to(user.room).emit("roomData", {
      room: user.room,
      users: getUsersInRoom(user.room)
    });

    callback();
  });

  socket.on("sendMessage", ({ message, room }, callback) => {
    console.log(socket.id);
    const user = getUser(socket.id);

    io.to(user.room).emit("message", { user: user.name, text: message });
    addMessageToRoom(db, message, room);

    callback();
  });

  socket.on("disconnect", () => {
    const user = removeUser(socket.id);

    if (user) {
      io.to(user.room).emit("message", {
        user: "Admin",
        text: `${user.name} has left.`
      });
      io.to(user.room).emit("roomData", {
        room: user.room,
        users: getUsersInRoom(user.room)
      });
    }
  });
});

server.listen(process.env.PORT || 5000, () =>
  console.log(`Server has started.`)
);
