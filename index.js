const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const cors = require("cors");
const admin = require("firebase-admin");
const util = require("util"); // for objects

// Functions for manipulating server model of active users
const {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom,
  addRoomOrIncrementOnlineUsers,
  decrementOnlineUsers,
  changeUserLocation,
} = require("./users");

// Functions for manipulating server model of active rooms
const {
  addRoom,
  removeUserFromRoom,
  addUserToRoom,
  getRoomInfo,
  getMostPopulousRooms,
} = require("./rooms");

// Helper functions
const { getCurrentTime } = require("./util");

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

const roomsRef = db.collection("rooms");
const usersRef = db.collection("users");
const testRef = roomsRef.doc("test");

// Fetches message history of a given room. Requires roomName string.
const getMessageHistory = async (roomName) => {
  const roomRef = db.doc(`rooms/${roomName}`);
  let room = await roomRef.get();
  if (room.exists) {
    return await room.data().messageHistory;
  } else {
    console.log("Room not found.");
    return "Room not found.";
  }
};

// Adds message to room thread. Takes a message object and a room name string
// Message object expected to look like { text, user, time }
const addMessageToRoom = async (message, roomName) => {
  const roomsRef = db.collection("rooms");
  const roomRef = roomsRef.doc(`${roomName}`);
  let room = await roomRef.get();
  if (room.exists) {
    roomRef.update({
      messageHistory: admin.firestore.FieldValue.arrayUnion(message),
    });
  } else {
    // doc.data() will be undefined in this case
    console.log(
      `Looked up ${roomName} in database, room.exists reads ${room.exists}`
    );
    const data = {
      messageHistory: [message],
    };
    roomsRef.doc(roomName).set(data);
  }
};

const updateClientRoomData = async (room) => {
  const promise = new Promise((resolve, reject) => {
    resolve(getRoomInfo(room));
  })
    .then((roomInfo) => {
      console.log(roomInfo);
      io.to(room).emit("roomData", {
        room: roomInfo.roomName,
        users: roomInfo.users,
        onlineUserCount: roomInfo.online,
      });
    })
    .catch((err) => {
      // ...error handling
      console.log(`Whoops, we had an error! \n${err}`);
    });
};

// socket.io event listeners
// they work by listening for the event named by the string argument.
io.on("connect", (socket) => {
  // gets displayName from socket
  const displayName = socket.handshake.query.displayName;

  // Add user to user list
  const { error, user } = addUser({
    id: socket.id,
    name: displayName,
  });

  // some lazy error handling - should be improved upon
  if (error || user) {
    console.log(`user: ${user}`);
    console.log(`error: ${error}`);
  }

  // a "join" event is expected to be accompanied by some data. a room to be joined and the username of the user joining
  socket.on("join", ({ name, room }, callback) => {
    let user = { id: socket.id, displayName: name, room: room };
    // Connect user
    socket.join(room);

    // Update room model to reflect new user's presence
    addUserToRoom(user, room);

    // Update user's location in userlist
    changeUserLocation({ id: socket.id, newRoom: room });

    // Send welcome message to user
    socket.emit("message", {
      user: "admin",
      text: `${name}, welcome to room ${room}.`,
      time: getCurrentTime(),
    });

    // Send "user-join" event to other users in room.
    socket.broadcast.to(room).emit("user-join", { user: name, id: socket.id });

    // Get Messages
    let messageHistory;
    getMessageHistory(room).then((msgs) => {
      // messageHistory will be empty or successfully retrieved
      messageHistory = msgs == "Room not found." ? [] : msgs;
      console.log(`Messagehistory:\n${messageHistory}`);

      // Send messageHistory to user
      socket.emit("messageHistory", messageHistory);
    });

    // Send updated roomData event to connected users so their front-end can be updated to reflect the state of the room.
    updateClientRoomData(room);

    // Send most populous rooms to clients.
    const topRooms = getMostPopulousRooms(8);
    socket.broadcast.emit("top8Rooms", topRooms);
  });

  // email, password expected
  socket.on("register-user", ({ email, password, displayName, uid }) => {
    // CREATE FIRESTORE USER DOC WITH INFORMATION, UID. WE WILL USE THIS TO TIE AUTH TO FRIENDS/ROOMS/OTHER USER INFO
    const userRef = usersRef.doc(uid);
    userRef.get().then((data) => {
      if (data.exists) {
        console.log("Error: User already exists.");
        return "Error: User already exists.";
      } else {
        const res = userRef
          .set({
            email,
            displayName,
            friends: [],
            rooms: [],
            avatar: "",
          })
          .then((res, displayName, email) => {
            socket.emit("register-user-success", {
              email,
              displayName,
            });
            return "Success! New user registered.";
          });
      }
    });
    // create user account with firebase
    // admin
    //   .auth()
    //   .createUserWithEmailAndPassword(email, password)
    //   .then((res) => {
    //     user.updateProfile({
    //       displayName: username,
    //     });
    // if successful, emit success event to front-end
    socket.emit("register-user-success");
    // })
    /*.catch(function (error) {
        // Handle Errors here. Needs improvement
        var errorCode = error.code;
        var errorMessage = error.message;
        // ...
      }); */
  });

  // FOLLOWING FUNCTIONS ARE SCAFFOLDED AND NOT TESTED WHATSOEVER

  // should fetch user's data without harming it.
  socket.on("fetch-user-friends", async (uid) => {
    const userRef = usersRef.doc(uid);
    await userRef.get().then((data) => {
      if (data.exists) {
        console.log(util.inspect(data, { showHidden: false, depth: null }));
        socket.emit("user-friends-list", data.friends);
      }
    });
  });

  // should add a friend from their data without harming it.
  socket.on("add-friend", async (userUID, friendUID) => {
    const userRef = usersRef.doc(userUID);
    const friendRef = usersRef.doc(friendUID);
    await userRef.get().then(async (userdata) => {
      if (userdata.exists) {
        const userNewFriends = [...userdata.friends, { uid: friendUID }];
        console.log(
          "user data " +
            util.inspect(userdata, { showHidden: false, depth: null })
        );
        await friendRef.get().then((data) => {
          if (data.exists) {
            console.log(
              "friend data " +
                util.inspect(data, { showHidden: false, depth: null })
            );
            userRef.update({ friends: userNewFriends });
          }
        });
      }
    });
  });

  // should remove a friend from their data without harming it.
  socket.on("remove-friend", async (userUID, friendUID) => {
    const userRef = usersRef.doc(userUID);
    const friendRef = usersRef.doc(friendUID);
    await userRef.get().then((data) => {
      if (data.exists) {
        // console.log(util.inspect(data, { showHidden: false, depth: null }));
        // socket.emit("user-friends-list", data.friends);
      }
    });
  });

  // END OF SCAFFOLDING

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

  socket.on(
    "sendMessage",
    ({ content: { text, user, time, room } }, callback) => {
      // socket id of message author
      const sender = getUser(socket.id);

      // actual message
      const message = { user, text, time, room };

      // console.logs to view message for lazy debugging purposes
      console.log(
        "sendMessage event detected! content:\n" +
          util.inspect(message, { showHidden: false, depth: null })
      );
      console.log(util.inspect(sender, { showHidden: false, depth: null }));

      // actual sending of message to other clients
      socket.broadcast.to(sender.room).emit("message", message);

      // update messageHistory in database with new message
      addMessageToRoom(message, room);

      callback();
    }
  );

  // Event fires when user closes chat window
  socket.on("room-disconnect", ({ room, name }) => {
    // socket disconnects from room
    socket.leave(room);

    // updates user location in internal model.
    changeUserLocation(socket.id, false);

    // Update count of online users in given room.
    removeUserFromRoom({ id: socket.id }, room);

    // Send message to FE that user has left
    socket.broadcast
      .to(room)
      .emit("user-disconnect", { user: name, id: socket.id });

    // Send updated roomData to connected users
    updateClientRoomData(room);
    //
    const topRooms = getMostPopulousRooms(8);
    socket.broadcast.emit("top8Rooms", topRooms);
  });

  socket.on("requestTop8Rooms", () => {
    const topRooms = getMostPopulousRooms(8);
    socket.emit("top8Rooms", topRooms);
  });

  // handles creation of new rooms by users
  socket.on(
    "createNewRoom",
    ({ roomName, passwordProtected, password, creator }) => {
      console.log(
        `createNewRoom event detected! \n ${
          (roomName, passwordProtected, password, creator)
        }`
      );
      roomsRef
        .doc(roomName)
        .get()
        .then((data) => {
          if (data.exists) {
            console.log("Error: roomName already taken");
            return "Error: roomName already taken";
          } else {
            const res = roomsRef
              .doc(roomName)
              .set({
                roomName: roomName,
                creator: creator,
                passwordProtected: passwordProtected,
                password: password,
                members: [creator],
              })
              .then((res) => {
                return "Success! New Room created.";
              });
          }
        });
    }
  );

  // Event fires when user disconnects from socket instance.
  socket.on("disconnecting", () => {
    const rooms = Object.keys(socket.rooms);

    // use socket.id to find username
    const username = getUser(socket.id).name;

    // Sends user-disconnect events to rooms user was active in.
    rooms.map((room) => {
      socket.broadcast
        .to(room)
        .emit("user-disconnect", { user: username, id: socket.id });
      // SEND UPDATED ROOMDATA TO ROOMS
      // ...
      removeUserFromRoom({ id: socket.id }, room);
    });
    // remove user from online users
    removeUser(socket.id);
    const topRooms = getMostPopulousRooms(8);
    socket.broadcast.emit("top8Rooms", topRooms);
  });
});
server.listen(process.env.PORT || 5000, () =>
  console.log(`Server has started on port ${process.env.PORT || 5000}.`)
);
