const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const cors = require("cors");
const admin = require("firebase-admin");


const { addUser, removeUser, getUser, getUsersInRoom, addRoomOrIncrementOnlineUsers, decrementOnlineUsers } = require("./users");

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
  // console.log(`Looking up roomName: ${roomName} in getMessageHistory`)
  const roomRef = db.doc(`rooms/${roomName}`);
  let room = await roomRef.get();
  // console.log("RoomRef: " + roomRef)
  // console.log("Room: " + room)
  // console.log("Room data: " + await room.data())
  // console.log("Room exists? " + room.exists);
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
  // Add user to user list
  const displayName = socket.handshake.query.displayName
  console.log("displayName: " + displayName)
  const { error, user } = addUser({
    id: socket.id,
    name: displayName,
  });
  if (error || user) {
    console.log(`user: ${user}`)
    console.log(`error: ${error}`)
  }
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
    // // Add user to user list
    // const { error, user } = addUser({
    //   id: socket.id,
    //   name,
    //   room,
    // });
    // Error occured

    // if (error) return callback(error);
    // Connect user
    socket.join(room);
    // Update server model of online users.
    console.log(`username: ${name} room: ${room}`)
    let onlineUserCount = addRoomOrIncrementOnlineUsers(room)
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
    console.log(getUsersInRoom(room))
    socket.broadcast
      .to(room)
      .emit("message", { user: "admin", text: `${name} has joined!` });
    io.to(room).emit("roomData", {
      room: room,
      users: getUsersInRoom(room),
      onlineUserCount
    });

    // callback();
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

  socket.on("room-disconnect", ({ room }) => {
    const removedUser = removeUser(socket.id);
    console.log(socket.id, removedUser)
    if (removedUser) {
      let newUserCount = decrementOnlineUsers(room)
      io.to(removedUser.room).emit("message", {
        user: "Admin",
        text: `${removedUser.name} disconnected`,
      });
      io.to(removedUser.room).emit("roomData", {
        room: removedUser.room,
        users: getUsersInRoom(removedUser.room),
        onlineUserCount: newUserCount
      });
    }
  });
  socket.on('disconnecting', (reason) => {
    let rooms = Object.keys(socket.rooms);
    console.log(`User disconnecting from ${rooms}`)
    let i;
    for (i = 0; i < rooms.length; i++) {
      decrementOnlineUsers(rooms[i])
    }
    // ...
  });
});
server.listen(process.env.PORT || 5000, () =>
  console.log(`Server has started on port ${process.env.PORT || 5000}.`)
);
