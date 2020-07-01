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

const getCurrentTime = () => {
  let today = new Date();
  let date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
  let time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
  let dateTime = date + ' ' + time;
  return dateTime
}

// Testing firebase functionality

// Fetches message history of a given room. Requires roomName string.
const getMessageHistory = async (roomName) => {
  console.log(`Looking up roomName: ${roomName} in getMessageHistory`)
  const roomRef = db.doc(`rooms/${roomName}`);
  let room = await roomRef.get();
  console.log("RoomRef: " + roomRef)
  console.log("Room: " + room)
  console.log("Room data: " + await room.data())
  console.log("Room exists? " + room.exists);
  room => {
    if (docSnapshot.exists) {
      usersRef.onSnapshot((doc) => {
        // do stuff with the data
        console.log("Here's the doc:\n" + doc)
      });
    } else {
      console.log("NOPE NO DOC HERE")
    }
  };
  if (room.exists) {
    return await room.data().messageHistory;
  } else {
    console.log("Room not found.")
    return "Room not found.";
  }
};

// Adds message to room thread.
// Takes a message object and a room name string
// Message object expected to look like { text, user, time }
const addMessageToRoom = async (message, roomName) => {
  console.log(`Looking up roomName: ${roomName} in addMessageToRoom`)
  const roomsRef = db.collection("rooms");
  const roomRef = roomsRef.doc(`${roomName}`);
  let room = await roomRef.get();
  if (room.exists) {
    roomRef.update({
      messageHistory: admin.firestore.FieldValue.arrayUnion(message),
    });
  } else {
    // doc.data() will be undefined in this case
    console.log(`Looked up ${roomName} in database, room.exists reads ${room.exists}`);
    const data = {
      messageHistory: [message],
    };
    roomsRef.doc(roomName).set(data);
  }
};

// socket.io event listenerss

io.on("connect", (socket) => {
  // const auth = admin.auth.onAuthStateChanged(function (user) {
  //   // listens for logins, logouts, registrations and fires. Undefined or null if no user logged in, user object provided if logged in.
  //   window.user = user; // user is undefined if no user signed in, window.user is accessible in other functions and kept current
  //   if (user) {
  //     console.log(user);
  //     socket.emit("login-successful", user);
  //     // handle
  //   } else {
  //     // handle
  //   }
  // });
  socket.on("join", ({ name, room }, callback) => {

    // Add user to user list
    const { error, user } = addUser({
      id: socket.id,
      name,
      room,
    });
    // Error occured
    console.log(error)
    if (error) return callback(error);
    // Connect user
    socket.join(room);
    // Send welcome message to user
    socket.emit("message", {
      user: "admin",
      text: `${name}, welcome to room ${room}.`,
      time: getCurrentTime()
    });
    // Get Messages
    let messageHistory;
    console.log(`user ${name} has joined room ${room}`)
    getMessageHistory(room).then(msgs => {
      // Message History is blank or found.
      messageHistory = (msgs == "Room not found." ? [] : msgs);
      // Send messageHistory to user
      console.log(`Messagehistory:\n${messageHistory}`)
      socket.emit("messageHistory", messageHistory);
    });
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

  socket.on("sendMessage", ({ content: { text, user, time, room } }, callback) => {
    const sender = getUser(socket.id);
    // console.log(user);
    const message = { user: user, text, time }
    console.log("sendMessage event detected! content:\n" + { user: user, text, time })
    io.to(sender.room).emit("message", message);
    addMessageToRoom(message, room);

    callback();
  });

  socket.on("disconnect", (user) => {
    // const user = removeUser(socket.id);
    console.log(user)
    socket.broadcast
      .to(user.room)
      .emit("message", { user: "admin", text: `${user.name} disconnected` });

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
