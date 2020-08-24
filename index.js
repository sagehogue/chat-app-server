const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const cors = require("cors");
const admin = require("firebase-admin");
const util = require('util') // for objects
// Functions for manipulating server model of active users
const { addUser, removeUser, getUser, getUsersInRoom, addRoomOrIncrementOnlineUsers, decrementOnlineUsers, changeUserLocation } = require("./users");
const router = require("./router");
const serviceAccount = require("./API_KEY.json"); // firebase API key

// TODOS:
// 1) Delete dead code
// 2) Complete online user model - currently nonfunctional/half complete

// List of socket events in use:
// "connect", "join", "message", "register-user", "login", "room-disconnect", 
// "user-join", "disconnecting"

// Initialization of express app + socket.io
const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Initializing firebase

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://chat-app-c2d82.firebaseio.com",
});

// enabling CORS
app.use(cors());
app.use(router);

// firebase database reference

db = admin.firestore();

// getting references to the collection of pre-existing rooms in firebase.
// remember "collections" are groups of "documents" in firebase.
// documents can be different datatypes but I am using objects. a collection could be imagined as an array of objects, but you interact
// with it a little differently than you would an array of objects.

const roomsRef = db.collection("rooms");
const testRef = roomsRef.doc("test");

// a function for creating timestamp strings

const getCurrentTime = () => {
  let today = new Date();
  let date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
  let time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
  let dateTime = date + ' ' + time;
  return dateTime
}

// Fetches message history of a given room. Requires roomName string.

const getMessageHistory = async (roomName) => {
  const roomRef = db.doc(`rooms/${roomName}`);
  let room = await roomRef.get();
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

// socket.io event listeners
// they work by listening for the event named by the string argument.
io.on("connect", (socket) => {

  // gets displayName from socket
  const displayName = socket.handshake.query.displayName

  // Add user to user list
  const { error, user } = addUser({
    id: socket.id,
    name: displayName,
  });

  // some lazy error handling - should be improved upon
  if (error || user) {
    console.log(`user: ${user}`)
    console.log(`error: ${error}`)
  }

  // a "join" event is expected to be accompanied by some data. a room to be joined and the username of the user joining
  socket.on("join", ({ name, room }, callback) => {

    // Connect user
    socket.join(room);

    // Update user's location
    changeUserLocation({id: socket.id, newRoom: room})

    // Increment online user counter for the room the user just joined
    console.log(`username: ${name} room: ${room}`)
    let onlineUserCount = addRoomOrIncrementOnlineUsers(room)

    // Send welcome message to user
    socket.emit("message", {
      user: "admin",
      text: `${name}, welcome to room ${room}.`,
      time: getCurrentTime()
    });

    // Send "user-join" event to other users in room.
    socket.broadcast.to(room).emit("user-join", {user: name, id: socket.id});

    // Get Messages
    let messageHistory;
    getMessageHistory(room).then(msgs => {

      // messageHistory will be empty or successfully retrieved
      messageHistory = (msgs == "Room not found." ? [] : msgs);
      console.log(`Messagehistory:\n${messageHistory}`)

      // Send messageHistory to user
      socket.emit("messageHistory", messageHistory);
    });

    // Send updated roomData event to connected users so their front-end can be updated to reflect the state of the room.
    const updatedRoomUserArray = getUsersInRoom(room)
    io.to(room).emit("roomData", {
      room: room,
      users: updatedRoomUserArray,
      onlineUserCount: updatedRoomUserArray.length
    });

    // Not sure what this was for, I don't recall trying to utilize any callbacks after a room join. Perhaps I could do password validation and utilize callbacks to report
    // success or failure?
    // callback();
  });

  // email, password expected
  socket.on("register-user", ({ email, password }) => {

    // create user account with firebase
    admin.auth().createUserWithEmailAndPassword(email, password)
      .then((res) => {

        // if successful, emit success event to front-end
        socket.emit("register-user-success");
      })
      .catch(function (error) {

        // Handle Errors here. Needs improvement
        var errorCode = error.code;
        var errorMessage = error.message;
        // ...
      });
  });

  // email, password expected
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

    // socket id of message author
    const sender = getUser(socket.id);

    // actual message
    const message = { user, text, time, room }

    // console.logs to view message for lazy debugging purposes
    console.log("sendMessage event detected! content:\n" + util.inspect(message, {showHidden: false, depth: null}))
    console.log(util.inspect(sender, {showHidden: false, depth: null}))

    // actual sending of message to other clients
    io.to(sender.room).emit("message", message);

    // update messageHistory in database with new message
    addMessageToRoom(message, room);

    callback();
  });

  // Event fires when user closes chat window
  socket.on("room-disconnect", ({ room }) => {
    
    // updates user location in internal model. this is important for keeping status accurate.
    changeUserLocation(socket.id, false)
    
    // Update count of online users in given room.
    decrementOnlineUsers(room)

    // Send message to FE that user has left
    socket.broadcast.to(room).emit("user-disconnect", {user: name, id: socket.id});

    // Send updated roomData to connected users
    const updatedRoomUserArray = getUsersInRoom(room)
    io.to(room).emit("roomData", {
      room: room,
      users: updatedRoomUserArray,
      onlineUserCount: updatedRoomUserArray.length
    });
  });

  // Event fires when user disconnects from socket instance.
  socket.on('disconnecting', (reason) => {
    let rooms, i

    // finds rooms user is in.
    rooms = Object.keys(socket.rooms);

    // Sends user-disconnect events to rooms user was active in.
    for (i = 0; i < rooms.length; i++) {
      socket.broadcast.to(rooms[i]).emit("user-disconnect", {user: name, id: socket.id});
    }
    // SEND UPDATED ROOMDATA TO ROOMS
    // ...

    // remove user from online users
    removeUser(socket.id)
  });

});
server.listen(process.env.PORT || 5000, () =>
  console.log(`Server has started on port ${process.env.PORT || 5000}.`)
);
