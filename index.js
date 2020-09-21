const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const cors = require("cors");
const admin = require("firebase-admin");
const util = require("util"); // for objects

// Functions for manipulating server model of active users
const { addUser, removeUser, getUser, changeUserLocation } = require("./users");

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
const { Console } = require("console");

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
const getMessageHistory = async (roomID) => {
  const roomRef = db.doc(`rooms/${roomID}`);
  let room = await roomRef.get();
  if (room.exists) {
    return await room.data().messageHistory;
  } else {
    return "Room not found.";
  }
};

// Adds message to room thread. Takes a message object and a room name string
// Message object expected to look like { text, user, time }
const addMessageToRoom = async (message, roomID) => {
  const roomsRef = db.collection("rooms");
  const roomRef = roomsRef.doc(`${roomID}`);
  let room = await roomRef.get();
  if (room.exists) {
    roomRef.update({
      messageHistory: admin.firestore.FieldValue.arrayUnion(message),
    });
  } else {
    // doc.data() will be undefined in this case
    // console.log(
    //   `Looked up ${roomName} in database, room.exists reads ${room.exists}`
    // );
    const data = {
      messageHistory: [message],
    };
    roomsRef.doc(roomName).set(data);
  }
};

const updateClientRoomData = async (room) => {
  // const promise = new Promise((resolve, reject) => {
  //   resolve(getRoomInfo(room.id));
  // })
  // .then((roomInfo) => {
  console.log(`ROOMDATA FOR: ${util.inspect(getRoomInfo(room.id))}`);
  const roomInfo = getRoomInfo(room.id);
  if (roomInfo) {
    io.to(room.id).emit("roomData", {
      room: roomInfo.roomName,
      users: roomInfo.users,
      onlineUserCount: roomInfo.online,
    });
  }
  // })
  // .catch((err) => {
  //   // ...error handling
  //   console.log(`Whoops, we had an error! \n${err}`);
  // });
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
  if (error) {
    console.log(`error: ${error}`);
  }

  // a "join" event expects {room: {id: ###, name: ""},user: {name: "", id: ###}}
  socket.on("join", ({ user, room }) => {
    // Connect user
    socket.join(room.id);
    user.room = room.roomName;

    // Update room model to reflect new user's presence
    addUserToRoom(user, room);

    // Update user's location in userlist
    changeUserLocation({ id: user.id, newRoom: room.id });

    // Send welcome message to user
    socket.emit("message", {
      user: "admin",
      text: `${user.displayName}, welcome to room ${room.roomName}.`,
      time: getCurrentTime(),
    });

    // Send "user-join" event to other users in room.
    socket.broadcast.to(room.id).emit("user-join", user);

    // Get Messages
    let messageHistory;
    getMessageHistory(room.id).then((msgs) => {
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
  socket.on("register-user", ({ email, displayName, uid }) => {
    // CREATE FIRESTORE USER DOC WITH INFORMATION, UID. WE WILL USE THIS TO TIE AUTH TO FRIENDS/ROOMS/OTHER USER INFO
    console.log("CREATING USER ACCOUNT");
    const userRef = usersRef.doc(uid);
    userRef.get().then((data) => {
      if (data.exists) {
        console.log("Error: User already exists.");
        return "Error: User already exists.";
      } else {
        console.log("CREATING USER ACCOUNT ON FIREBASE");
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
    ({ content: { text, user, time, room, uid } }, callback) => {
      console.log(
        `SENDMESSAGE CONTENT: ${util.inspect({ text, user, time, room, uid })}`
      );

      // socket id of message author
      const sender = getUser(uid);

      // actual message
      const message = { user, text, time, room, uid };

      // actual sending of message to other clients
      socket.broadcast.to(room).emit("message", message);

      // update messageHistory in database with new message
      addMessageToRoom(message, room);

      callback();
    }
  );

  // Event fires when user closes chat window
  socket.on("room-disconnect", ({ room, user }) => {
    // socket disconnects from room
    socket.leave(room.id);

    // updates user location in internal model.
    changeUserLocation(user.id, false);

    // Update count of online users in given room.
    removeUserFromRoom(user, room);

    // Send message to FE that user has left
    socket.broadcast.to(room.id).emit("user-disconnect", user);

    // Send updated roomData to connected users
    updateClientRoomData(room);
    //
    const topRooms = getMostPopulousRooms(8);
    socket.broadcast.emit("top8Rooms", topRooms);
  });

  // handles creation of new rooms by users
  socket.on(
    "createNewRoom",
    ({ roomName, passwordProtected, password, creator, creatorUID }) => {
      roomsRef
        .add({
          roomName: roomName,
          creator: creator,
          passwordProtected: passwordProtected,
          password: password,
          members: [{ displayName: creator, uid: creatorUID, role: "creator" }],
        })
        .then(async (res) => {
          const userRef = usersRef.doc(creatorUID);
          const result = await userRef.update({
            rooms: admin.firestore.FieldValue.arrayUnion({
              id: res.id,
              roomName: roomName,
            }),
          });
          return "Success! New Room created with ID: " + res.id;
        });
      // .get()
      // .then((data) => {
      //   if (data.exists) {
      //     console.log("Error: roomName already taken");
      //     return "Error: roomName already taken";
      //   } else {
      //     const res = roomsRef

      //   }
      // });
    }
  );

  socket.on("add-user-room", async ({ uid, roomID, favorite = false }) => {
    // addNewSavedRoom(userUID, roomUID)
    const userRef = usersRef.doc(uid);
    const res = await userRef.update({
      rooms: admin.firestore.FieldValue.arrayUnion({
        id: roomID,
        favorite: favorite,
      }),
    });
  });

  socket.on("remove-user-room", async ({ uid, roomID }) => {
    // addNewSavedRoom(userUID, roomUID)
    const userRef = usersRef.doc(uid);
    const res = await userRef.update({
      rooms: admin.firestore.FieldValue.arrayRemove({ id: roomID }),
    });
  });

  // pending friends and ones you accept, sentrequests are those other user accepts.
  socket.on("add-friend", async ({ uid, friendUID }) => {
    // addNewSavedRoom(userUID, roomUID)
    const newSentFriendRequest = {
      uid: friendUID,
      isFriend: "sent",
    };
    const newPendingFriend = {
      uid: uid,
      isFriend: "pending",
    };
    const userRef = usersRef.doc(uid);
    const userDoc = await userRef.get();
    const friendRef = usersRef.doc(friendUID);
    const friendDoc = await friendRef.get();
    if (userDoc.exists && friendDoc.exists) {
      const userData = userDoc.data();
      const friendData = friendDoc.data();
      newSentFriendRequest.displayName = friendData.displayName;
      const addFriendRes = await userRef.update({
        friends: admin.firestore.FieldValue.arrayUnion(newSentFriendRequest),
      });
      newPendingFriend.displayName = userData.displayName;
      const friendReceiveRequestRes = await friendRef.update({
        friends: admin.firestore.FieldValue.arrayUnion(newPendingFriend),
      });
    }
  });

  socket.on("remove-friend", async ({ uid, friendUID }) => {
    // addNewSavedRoom(userUID, roomUID)
    const userRef = usersRef.doc(uid);
    const friendRef = usersRef.doc(friendUID);
    const removeFriendRes = await userRef.update({
      friends: admin.firestore.FieldValue.arrayRemove({
        uid: friendUID,
      }),
    });
    const removeUserFromFriendRes = await friendRef.update({
      friends: admin.firestore.FieldValue.arrayRemove({
        uid: uid,
      }),
    });
  });

  socket.on("requestTop8Rooms", () => {
    const topRooms = getMostPopulousRooms(8);
    socket.emit("top8Rooms", topRooms);
  });

  socket.on("requestUserRooms", async (uid) => {
    const userRef = usersRef.doc(uid);
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      socket.emit("userRooms", userDoc.data().rooms);
    }
  });

  // should fetch user's data without harming it.
  socket.on("fetch-friends", async ({ uid }) => {
    console.log(`UID for friend fetching ` + uid);
    const userRef = usersRef.doc(uid);
    await userRef.get().then((data) => {
      if (data.exists) {
        console.log(
          `FRIEND DATA FOR YA` +
            util.inspect(data.data().friends, {
              showHidden: false,
              depth: null,
            })
        );
        socket.emit("userFriends", data.data().friends);
      }
    });
  });

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
