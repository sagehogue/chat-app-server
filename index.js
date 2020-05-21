const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const cors = require("cors");
const admin = require("firebase-admin");

const { addUser, removeUser, getUser, getUsersInRoom } = require("./users");

const router = require("./router");
const serviceAccount = require("./API_KEY.json");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Initializing firebase

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://chat-app-c2d82.firebaseio.com",
});

app.use(cors());
app.use(router);

db = admin.firestore();
const roomsRef = db.collection("rooms");
const testRef = roomsRef.doc("test");

// Testing firebase functionality

// Fetches message history of a given room. Requires roomName string.
const getMessageHistory = async (roomName) => {
  const roomRef = db.doc(`rooms/${roomName}`);
  let room = await roomRef.get();
  if (room.exists) {
    console.log("Document data:", room.data().messageHistory);
    return room.data().getMessageHistory;
  } else {
    return "Room not found.";
  }
};

// Adds message to room thread.
// Takes a message object and a room name string
// Message object expected to look like { message, user, time }
const addMessageToRoom = async (message, roomName) => {
  const roomsRef = db.collection("rooms");
  const roomRef = db.doc(`rooms/${roomName}`);
  let room = await roomRef.get();
  if (room.exists) {
    roomRef.update({
      messageHistory: admin.firestore.FieldValue.arrayUnion(message),
    });
  } else {
    // doc.data() will be undefined in this case
    // TODO: Implement room creation
    console.log("No such document!");
    roomPreviouslyExisted = false;
    const data = {
      messageHistory: [message],
    };
    roomsRef.doc(roomName).set(data);
  }
};

// socket.io event listenerss

io.on("connect", (socket) => {
  const auth = admin.auth();
  // listens for logins, logouts, registrations and fires. Undefined or null if no user logged in, user object provided if logged in.
  auth.onAuthStateChanged(function (user) {
    window.user = user; // user is undefined if no user signed in, window.user is accessible in other functions and kept current
    if (user) {
      console.log(user);
      socket.emit("login-successful", user);
      // handle
    } else {
      // handle
    }
  });
  socket.on("join", ({ name, room }, callback) => {
    // Get Messages
    let messageHistory;
    getMessageHistory(room).then((msgs) => {
      // Message History is blank or found.
      messageHistory = msgs == "Room not found." ? [] : msgs;
    });
    // Add user to user list
    const { error, user } = addUser({
      id: socket.id,
      name,
      room,
    });

    // Error occured
    if (error) return callback(error);
    // Connect user
    socket.join(room);
    // Send welcome message to user
    socket.emit("message", {
      user: "admin",
      text: `${name}, welcome to room ${room}.`,
    });
    // Send messageHistory to user
    socket.emit("messageHistory", messageHistory);
    // Send announcement to room that user has joined.
    socket.broadcast
      .to(user.room)
      .emit("message", { user: "admin", text: `${user.name} has joined!` });
    io.to(user.room).emit("roomData", {
      room: user.room,
      users: getUsersInRoom(user.room),
    });

    callback();
  });

  socket.on("register-user", ({ email, password }) => {
    admin
      .auth()
      .createUserWithEmailAndPassword(email, password)
      .then((res) => {
        socket.emit("register-user-success");
      })
      .catch(function (error) {
        // Handle Errors here.
        var errorCode = error.code;
        var errorMessage = error.message;
        // ...
      });
  });

  socket.on("login", ({ email, password }) => {
    admin
      .auth()
      .signInWithEmailAndPassword(email, password)
      .catch(function (error) {
        // Handle Errors here.
        var errorCode = error.code;
        var errorMessage = error.message;
        // ...
      });
  });

  socket.on("sendMessage", ({ message, room }, callback) => {
    const user = getUser(socket.id);
    // console.log(user);
    io.to(user.room).emit("message", { user: user.name, text: message });
    addMessageToRoom(message, room);

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
  console.log(`Server has started on port ${process.env.PORT || 5000}.`)
);
