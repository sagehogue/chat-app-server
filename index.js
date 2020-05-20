const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const cors = require("cors");
<<<<<<< HEAD
const admin = require("firebase-admin");
=======
admin = require("firebase-admin");
>>>>>>> 3359d602602412f6e47d7917102a050030a2476a

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
  databaseURL: "https://chat-app-c2d82.firebaseio.com",
});

app.use(cors());
app.use(router);
const myObj = { hey: "that" };
myObj.hey;

db = admin.firestore();
const roomsRef = db.collection("rooms");
const testRef = roomsRef.doc("test");

<<<<<<< HEAD
// Testing firebase functionality

// This is how you set a message - specifically how to update an array of objects in firebase with a new entry
let setTestMessages = testRef.update({
  messageHistory: admin.firestore.FieldValue.arrayUnion({
    name: "David Lucas",
    message: "your toilet seat is probably shaped like a dildo",
    time: new Date().toLocaleString(),
  }),
});

=======
>>>>>>> 3359d602602412f6e47d7917102a050030a2476a
// This is how to log all data from a collection

let getDoc = roomsRef
  .get()
  .then((col) => {
    col.forEach((doc) => {
      if (!doc.exists) {
        console.log("No such document!");
      } else {
        console.log(`Document Name: ${doc.id}\n`, "Document data:", doc.data());
      }
    });
  })
  .catch((err) => {
    console.log("Error getting document", err);
  });

// socket.io event listenerss

io.on("connect", (socket) => {
  socket.on("join", ({ name, room }, callback) => {
    let messageHistory;
    // Get Messages
<<<<<<< HEAD
    const getMessage = getMessageHistory(db, room).then((err, msgs) => {
      // Add user to user list
      const { error, user } = ({ error, user } = addUser({
        id: socket.id,
        name,
        room,
      }));
=======
    const returnMessages = getMessageHistory(db, room).then((err, msgs) => {
      // Add user to user list
      const { error, user } = addUser({
        id: socket.id,
        name,
        room
      });
>>>>>>> 3359d602602412f6e47d7917102a050030a2476a
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
<<<<<<< HEAD
        text: `${user.name}, welcome to room ${user.room}.`,
=======
        text: `${user.name}, welcome to room ${user.room}.`
>>>>>>> 3359d602602412f6e47d7917102a050030a2476a
      });
      // Send messageHistory to user
      socket.emit("messageHistory", messageHistory);
      // Send announcement to room that user has joined.
      socket.broadcast
        .to(user.room)
        .emit("message", { user: "admin", text: `${user.name} has joined!` });
<<<<<<< HEAD
    });
    const { error, user } = addUser({ id: socket.id, name, room });

    if (error) return callback(error);

    socket.join(user.room);

    socket.emit("message", {
      user: "admin",
      text: `${user.name}, welcome to room ${user.room}.`,
=======
>>>>>>> 3359d602602412f6e47d7917102a050030a2476a
    });
    io.to(user.room).emit("roomData", {
      room: user.room,
      users: getUsersInRoom(user.room),
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
        text: `${user.name} has left.`,
      });
      io.to(user.room).emit("roomData", {
        room: user.room,
        users: getUsersInRoom(user.room),
      });
    }
  });
});
console.log(process.env.PORT || 5000);
server.listen(process.env.PORT || 5000, () =>
  console.log(`Server has started.`)
);
