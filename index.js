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

// Initializing firebase

const serviceAccount = require("./API_KEY.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://chat-app-c2d82.firebaseio.com"
});

app.use(cors());
app.use(router);

db = admin.firestore();
const roomsRef = db.collection("/rooms");
const testRef = roomsRef.doc("test");

// Testing firebase functionality

// This is how you set a message - specifically how to update an array of objects in firebase with a new entry
let setTestMessages = testRef.update({
  messageHistory: admin.firestore.FieldValue.arrayUnion({
    name: "David Lucas",
    message: "your toilet seat is probably shaped like a dildo",
    time: new Date().toLocaleString()
  })
});

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

// socket.io event listeners

io.on("connect", socket => {
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
    const { error, user } = addUser({ id: socket.id, name, room });

    if (error) return callback(error);

    socket.join(user.room);

    socket.emit("message", {
      user: "admin",
      text: `${user.name}, welcome to room ${user.room}.`
    });
    socket.broadcast
      .to(user.room)
      .emit("message", { user: "admin", text: `${user.name} has joined!` });

    io.to(user.room).emit("roomData", {
      room: user.room,
      users: getUsersInRoom(user.room)
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
