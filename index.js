const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const cors = require("cors");
const admin = require("firebase-admin");
// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
const functions = require("firebase-functions");

const util = require("util"); // for objects

// Functions for manipulating server model of active users
const {
  addUser,
  removeUser,
  getUserFromID,
  getUserFromSocketID,
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
const { Console } = require("console");

// TODOS:
// 1) Delete dead code & refactor
// 2) Create user status system
// 3) Add to room status system
// 4) Improve documentation

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

// Document collections of user rooms, user accounts.

const roomsRef = db.collection("rooms");
const usersRef = db.collection("users");

// FUNCTIONS

// Fetches logged messages for a given room ID
const getMessageHistory = async (roomID) => {
  const roomRef = db.doc(`rooms/${roomID}`);
  let room = await roomRef.get();
  if (room.exists) {
    return await room.data().messageHistory;
  } else {
    return "Room not found.";
  }
};

// Adds message to room thread. Takes a message object and a room ID string
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
    const data = {
      messageHistory: [message],
    };
    roomsRef.doc(roomID).set(data);
  }
};

// CURRENTLY BROKEN
const updateClientRoomData = async (room) => {
  console.log(`ROOMDATA FOR: ${util.inspect(getRoomInfo(room.id))}`);
  const roomInfo = getRoomInfo(room.id);
  if (roomInfo) {
    io.to(room.id).emit("roomData", {
      room: roomInfo.roomName,
      users: roomInfo.users,
      onlineUserCount: roomInfo.online,
    });
  }
};

// SOCKET EVENT LISTENERS

// Events in use:
// "connect", "register-user", "join", "login", "sendMessage"
// "room-disconnect", "createNewRoom", "add-user-room", "remove-user-room"
// "add-friend", "remove-friend", "accept-friend-request", "decline-friend-request",
// "cancel-friend-request", "requestTop8Rooms", requestUserRooms, "fetch-friends", "disconnecting"
io.on("connect", (socket) => {
  // gets displayName from socket
  let displayName, accountID;
  const sessionID = socket.id;
  if (socket.handshake.query.id) {
    displayName = socket.handshake.query.displayName;
    accountID = socket.handshake.query.id;
  }
  console.log("Connection: " + accountID);

  // Add user to user list
  // const { error, user } = addUser({
  //   id: socket.id,
  //   name: displayName,
  // });

  // a "join" event expects {room: {id: ###, name: ""},user: {name: "", id: ###}}
  socket.on("join", ({ user, room }) => {
    console.log(`User: ${util.inspect(user)} \nRoom: ${util.inspect(room)}`);
    // Add user to user list
    addUser({
      id: user.id,
      room: room.id,
      socket: socket.id,
      name: user.displayName,
    });
    // Connect user
    socket.join(room.id);
    // user.room = room.roomName;

    // Update room model to reflect new user's presence
    addUserToRoom(user, room);

    // Update user's location in userlist
    // changeUserLocation({ id: user.id, newRoom: room.id });

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
    const userRef = usersRef.doc(uid);
    userRef.get().then((data) => {
      if (data.exists) {
        throw new Error("User already exists.");
      } else {
        console.log("CREATING USER ACCOUNT ON FIREBASE");
        const newUser = {
          email,
          displayName,
          friends: [],
          rooms: [],
          avatar: "",
        };
        userRef.set(newUser).then((res, newUser) => {
          socket.emit("register-user-success", {
            email: newUser.email,
            displayName: newUser.displayName,
          });
          return "Success! New user registered.";
        });
      }
    });
    socket.emit("register-user-success");

    // create user account with firebase
    // admin
    //   .auth()
    //   .createUserWithEmailAndPassword(email, password)
    //   .then((res) => {
    //     user.updateProfile({
    //       displayName: username,
    //     });
    // if successful, emit success event to front-end

    // })
    /*.catch(function (error) {
        // Handle Errors here. Needs improvement
        var errorCode = error.code;
        var errorMessage = error.message;
        // ...
      }); */
    // </ SUSPECTED DEAD CODE>
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
      const sender = getUserFromID(uid);

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

  // handles creation of new rooms by users (old version)
  // socket.on(
  //   "createNewRoom",
  //   ({ roomName, passwordProtected, password, creator, creatorUID }) => {
  //     roomsRef
  //       .add({
  //         roomName: roomName,
  //         creator: creator,
  //         passwordProtected: passwordProtected,
  //         password: password,
  //         members: [{ displayName: creator, id: creatorUID, role: "creator" }],
  //       })
  //       .then(async (res) => {
  //         const userRef = usersRef.doc(creatorUID);
  //         const result = await userRef.update({
  //           rooms: admin.firestore.FieldValue.arrayUnion({
  //             id: res.id,
  //             roomName: roomName,
  //           }),
  //         });
  //         return "Success! New Room created with ID: " + res.id;
  //       });

  // handles creation of new rooms by users
  socket.on("createNewRoom", async (data) => {
    const {
      roomName,
      passwordProtected,
      password,
      creator,
      creatorUID,
      roomID,
    } = data;

    let avatar;
    if (data.avatar) {
      avatar = data.avater;
    } else {
      avatar = "";
    }

    const userRef = usersRef.doc(creatorUID);
    const roomRef = roomsRef.doc(roomID);
    socket.join(roomID);

    db.runTransaction(function (transaction) {
      return transaction.getAll(roomRef, userRef).then((docs) => {
        const roomDoc = docs[0];
        const userDoc = docs[1];
        if (!userDoc.exists) {
          throw Error("User does not exist!");
        }

        const userData = userDoc.data();

        const roomForUser = { id: roomID, roomName: roomName, avatar };
        const roomDocContent = {
          id: roomID,
          roomName: roomName,
          avatar,
          creator: creator,
          passwordProtected: passwordProtected,
          password: password,
          members: [{ displayName: creator, id: creatorUID, role: "creator" }],
        };

        const newUserRooms = [...userData.rooms, roomForUser];

        transaction.set(roomRef, roomDocContent);

        transaction.update(userRef, { rooms: newUserRooms });
      });
    }).then(() => {
      const user = {
        displayName: creator,
        id: creatorUID,
        sessionID,
      };
      const room = { id: roomID, roomName };
      updateClientRoomData(addRoom(room, user));
      socket.emit("message", {
        user: "admin",
        text: `${user.displayName}, welcome to ${room.roomName}, your new room. Invite some friends, or secure it with a password in the settings.`,
        time: getCurrentTime(),
      });
    });
  });

  socket.on("user-status", (user) => {
    addUser(user);
  });

  socket.on("fetch-avatar", async ({ id }) => {
    const userRef = usersRef.doc(id);
    const userDoc = await userRef.get();
    let userData;
    if (userDoc.exists) {
      userData = userDoc.data();
      if (userData.avatar) {
        socket.emit("new-avatar", {
          url: userData.avatar.url,
          id: userData.avatar.id,
        });
      }
    }
  });

  socket.on("change-avatar", async ({ id, image }) => {
    const userRef = usersRef.doc(id);
    await userRef.update({ avatar: image }).then((res) => {
      socket.emit("new-avatar", image);
    });
  });

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

  // pending friends are ones you accept, sentrequests are those other user accepts.
  // this function sends a friend request
  socket.on("add-friend", async ({ uid, friendUID }) => {
    console.log(`ADD-FRIEND\nID: ${uid} \nFRIEND: ${friendUID}`);
    const userRef = usersRef.doc(uid);
    const friendRef = usersRef.doc(friendUID);
    // for user
    const newSentFriendRequest = {
      id: friendUID,
      isFriend: "sent",
    };
    // for friend
    const newPendingFriend = {
      id: uid,
      isFriend: "pending",
    };
    db.runTransaction(function (transaction) {
      return transaction.getAll(userRef, friendRef).then((docs) => {
        const authorDoc = docs[0];
        const recipientDoc = docs[1];

        if (!authorDoc.exists || !recipientDoc.exists) {
          throw "Document does not exist!";
        }
        const authorData = authorDoc.data();
        const recipientData = recipientDoc.data();
        // Get array of request author & recipient friend lists
        const authorFriends = authorData.friends;
        const recipientFriends = recipientData.friends;
        // Put displayNames on the new friend objects.
        newPendingFriend.displayName = authorData.displayName;
        newSentFriendRequest.displayName = recipientData.displayName;
        // if friends lists do not contain any other friend objects for the newly provided UIDs, add the objects to the arrays.
        let nonDuplicateFriend = true;
        authorFriends.map((friend) => {
          if (friend.id === friendUID) {
            nonDuplicateFriend = false;
          }
        });
        recipientFriends.map((friend) => {
          if (friend.id === uid) {
            nonDuplicateFriend = false;
          }
        });
        if (nonDuplicateFriend) {
          let recipientUser;
          recipientUser = getUser(friendUID);
          if (recipientUser) {
            socket.emit("new-friend-request", newPendingFriend);
          }
          const newAuthorFriendArray = [...authorFriends, newSentFriendRequest];
          const newRecipientFriendArray = [...authorFriends, newPendingFriend];
          transaction.update(userRef, { friends: newAuthorFriendArray });
          transaction.update(friendRef, { friends: newRecipientFriendArray });
        } else {
          throw "Error! Duplicate friend request";
        }
      });
    });
  });

  socket.on("accept-friend-request", async ({ id, requestAuthorID }) => {
    // Renaming some destructured object properties for improved legibility
    const recipientID = id;
    const authorID = requestAuthorID;
    const authorRef = usersRef.doc(authorID);
    const recipientRef = usersRef.doc(recipientID);
    // Initialize new transaction
    db.runTransaction(function (transaction) {
      return transaction.getAll(authorRef, recipientRef).then((docs) => {
        const authorDoc = docs[0];
        const recipientDoc = docs[1];
        if (!authorDoc.exists || !recipientDoc.exists) {
          throw "Document does not exist!";
        }
        const authorData = authorDoc.data();
        const recipientData = recipientDoc.data();
        // Get array of request author & recipient friend lists
        const authorFriends = authorData.friends;
        const recipientFriends = recipientData.friends;
        // Filter out accepted friend request
        const newAuthorFriendsArray = authorFriends.map((friend) => {
          if (friend.id == recipientID) {
            return {
              displayName: friend.displayName,
              id: friend.id,
              isFriend: true,
            };
          } else {
            return friend;
          }
        });
        // create new array, replacing pending request with friend object.
        const newRecipientFriendsArray = recipientFriends.map((friend) => {
          if (friend.id == authorID) {
            return {
              displayName: friend.displayName,
              id: friend.id,
              isFriend: true,
            };
          } else {
            return friend;
          }
        });
        // update friends with new array
        transaction.update(authorRef, { friends: newAuthorFriendsArray });
        // update friends with new array
        transaction.update(recipientRef, { friends: newRecipientFriendsArray });
      });
    });
  });

  socket.on("decline-friend-request", async ({ id, requestAuthorID }) => {
    console.log(`DECLINE FRIEND REQUEST
    \nID: ${id}\n
    AUTHOR ID: ${requestAuthorID}`);
    const recipientID = id;
    const authorID = requestAuthorID;
    const authorRef = usersRef.doc(authorID);
    const recipientRef = usersRef.doc(recipientID);

    db.runTransaction(function (transaction) {
      return transaction.getAll(authorRef, recipientRef).then((docs) => {
        const authorDoc = docs[0];
        const recipientDoc = docs[1];
        if (!authorDoc.exists || !recipientDoc.exists) {
          throw "Document does not exist!";
        }
        const authorData = authorDoc.data(); // Get array of request author & recipient friend lists
        const recipientData = recipientDoc.data();

        const authorFriends = authorData.friends;
        const recipientFriends = recipientData.friends;

        // Filter out declined friend request
        const newAuthorFriendsArray = authorFriends.filter(
          (friend) => friend.id !== recipientID
        );
        // create new array, replacing pending request with friend object.
        const newRecipientFriendsArray = recipientFriends.filter(
          (friend) => friend.id !== authorID
        );
        // update friends with new array
        transaction.update(authorRef, { friends: newAuthorFriendsArray });
        // update friends with new array
        transaction.update(recipientRef, { friends: newRecipientFriendsArray });
      });
    });
  });

  socket.on("remove-friend", async ({ uid, friendUID }) => {
    console.log(`REMOVING USER\n UID: ${uid}\nFRIEND UID: ${friendUID}`);
    const userRef = usersRef.doc(uid);
    const userDoc = await userRef.get();
    const friendRef = usersRef.doc(friendUID);
    const friendDoc = await friendRef.get();

    if (userDoc.exists && friendDoc.exists) {
      const arrayRemove = admin.firestore.FieldValue.arrayRemove;
      const userData = userDoc.data();
      const friendData = friendDoc.data();
      // get index of friend to remove from user
      const indexForUser = userData.friends.findIndex(
        (friend) => friend.id == friendUID
      );

      // deletion
      userRef.update({ friends: arrayRemove(userData.friends[indexForUser]) });

      // get index of user to remove from friend
      const indexForFriend = friendData.friends.findIndex(
        (friend) => friend.id == uid
      );
      // deletion
      friendRef.update({
        friends: arrayRemove(friendData.friends[indexForFriend]),
      });
      // const removeFriendRes = await userRef.update({
      //   friends: admin.firestore.FieldValue.arrayRemove({
      //     id: friendUID,
      //   }),
      // });
      // const removeUserFromFriendRes = await friendRef.update({
      //   friends: admin.firestore.FieldValue.arrayRemove({
      //     id: uid,
      //   }),
      // });
    } else {
      // handle bad request
    }
  });

  socket.on("cancel-friend-request", ({ authorID, recipientID }) => {
    const authorRef = usersRef.doc(authorID);
    const recipientRef = usersRef.doc(recipientID);
    db.runTransaction(function (transaction) {
      return transaction.getAll(authorRef, recipientRef).then((docs) => {
        console.log(util.inspect(docs[0].data()));
        console.log(util.inspect(docs[1].data()));
        const userDoc = docs[0];
        const recipientDoc = docs[1];
        if (!userDoc.exists || !recipientDoc.exists) {
          throw "Document does not exist!";
        }
        const userData = userDoc.data();
        const recipientData = recipientDoc.data();
        // Get array of user friends
        const userFriends = userData.friends;
        const recipientFriends = recipientData.friends;
        // Filter out canceled friend request
        const newFriendsArray = userFriends.filter(
          (friend) => friend.id !== recipientID
        );
        const newRecipientFriendsArray = recipientFriends.filter(
          (friend) => friend.id !== authorID
        );
        // update friends with new array
        transaction.update(authorRef, { friends: newFriendsArray });
        // update friends with new array
        transaction.update(recipientRef, { friends: newRecipientFriendsArray });
      });
    });
  });

  socket.on("requestTop8Rooms", () => {
    const topRooms = getMostPopulousRooms(8);
    socket.emit("top8Rooms", topRooms);
  });

  socket.on("requestUserRooms", async (id) => {
    const userRef = usersRef.doc(id);
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

  //saving and removing saved rooms

  socket.on("add-saved-room", ({ id, roomID }) => {
    const userRef = usersRef.doc(id);
    const roomRef = roomsRef.doc(roomID);
    let userRoomData;
    db.runTransaction(function (transaction) {
      return transaction.getAll(userRef, roomRef).then((docs) => {
        const userDoc = docs[0];
        const roomDoc = docs[1];
        if (!userDoc.exists || !roomDoc.exists) {
          throw "Document does not exist!";
        }
        const userData = userDoc.data();
        const roomData = roomDoc.data();
        // Get array of user rooms and room members
        const userRooms = userData.rooms;
        const roomMembers = roomData.members;
        // Filter out already favorited rooms

        try {
          userRooms.map((room) => {
            if (room.id === roomID) {
              throw new Error("This room is already saved");
            }
          });
        } catch (err) {
          // handle error
        }
        const newSavedRoom = {
          id: roomID,
          roomName: roomData.roomName,
          isFavorite: false,
        };

        const newUserSavedRooms = [...userRooms, newSavedRoom];

        const newRoomMember = {
          id,
          displayName: userData.displayName,
          role: "member",
        };

        const newRoomMembers = [...roomMembers, newRoomMember];

        userRoomData = newUserSavedRooms;
        // update friends with new array
        transaction.update(userRef, { rooms: newUserSavedRooms });
        // update friends with new array
        transaction.update(roomRef, { members: newRoomMembers });
      });
    }).then(() => {
      socket.emit("userRooms", userRoomData);
    });
  });

  socket.on("rmv-saved-room", ({ id, roomID }) => {
    const userRef = usersRef.doc(id);
    const roomRef = roomsRef.doc(roomID);
    let userRoomList;
    db.runTransaction(function (transaction) {
      return transaction
        .getAll(userRef, roomRef)
        .then((docs) => {
          const userDoc = docs[0];
          const roomDoc = docs[1];
          if (!userDoc.exists || !roomDoc.exists) {
            throw "Document does not exist!";
          }
          const userData = userDoc.data();
          const roomData = roomDoc.data();
          // Get array of user rooms and room members
          const userRooms = userData.rooms;
          const roomMembers = roomData.members;
          const filteredRoomsArray = userRooms.filter(
            (room) => room.id !== roomID
          );
          const filteredRoomMembersArray = roomMembers.filter(
            (member) => id !== member.id
          );

          userRoomList = filteredRoomMembersArray;

          transaction.update(userRef, { rooms: filteredRoomsArray });
          transaction.update(roomRef, { members: filteredRoomMembersArray });
        })
        .then(() => {
          socket.emit("userRooms", userRoomList);
        });
    });
  });

  // for add favorite room

  socket.on("add-favorite-room", ({ id, roomID }) => {
    const userRef = usersRef.doc(id);
    const roomRef = roomsRef.doc(roomID);
    let userRoomData;
    let newUserRooms;
    let shouldUpdateUserRooms = true;
    let shouldUpdateMemberList = true;
    let roomPreviouslySaved = false;
    db.runTransaction(function (transaction) {
      return transaction.getAll(userRef, roomRef).then((docs) => {
        const userDoc = docs[0];
        const roomDoc = docs[1];
        if (!userDoc.exists || !roomDoc.exists) {
          throw "Document does not exist!";
        }
        const userData = userDoc.data();
        const roomData = roomDoc.data();
        // Get array of user rooms and room members
        const userRooms = userData.rooms;
        const roomMembers = roomData.members;
        // Filter out already favorited rooms

        try {
          userRooms.map((room) => {
            if (room.id === roomID) {
              roomPreviouslySaved = true;
              shouldUpdateMemberList = false;
              if (room.isFavorite === true) {
                shouldUpdateUserRooms = false;
                throw new Error("This room is already favorited");
              } else {
                newUserRooms = userRooms.filter(
                  (room) => !(roomID === room.id)
                );
                userRoomData = newUserRooms;
                const newRoom = { ...room, isFavorite: true };
                newUserRooms.push(newRoom);
              }
            }
          });
        } catch (err) {
          console.log(`ERROR: ${error}`);
          // handle error
        }
        if (!roomPreviouslySaved) {
          newUserRooms = [
            ...userRooms,
            { id: roomID, roomName: roomData.roomName, isFavorite: true },
          ];
          userRoomData = newUserRooms;
        }

        const newRoomMember = {
          id,
          displayName: userData.displayName,
          role: "member",
        };

        const newRoomMembers = [...roomMembers, newRoomMember];

        // update friends with new array
        if (shouldUpdateUserRooms) {
          transaction.update(userRef, { rooms: newUserRooms });
        }
        // update friends with new array
        if (shouldUpdateMemberList) {
          transaction.update(roomRef, { members: newRoomMembers });
        }
      });
    }).then(() => {
      socket.emit("userRooms", userRoomData);
    });
  });

  //remove favorite room

  // socket.on("rmv-favorite-room", ({ id, roomID }) => {
  //   const userRef = usersRef.doc(id);
  //   const roomRef = roomsRef.doc(roomID);
  //   let userRoomList;
  //   db.runTransaction(function (transaction) {
  //     return transaction
  //       .getAll(userRef, roomRef)
  //       .then((docs) => {
  //         const userDoc = docs[0];
  //         const roomDoc = docs[1];
  //         if (!userDoc.exists || !roomDoc.exists) {
  //           throw "Document does not exist!";
  //         }
  //         const userData = userDoc.data();
  //         const roomData = roomDoc.data();
  //         // Get array of user rooms and room members
  //         const userRooms = userData.rooms;
  //         const roomMembers = roomData.members;
  //         const filteredRoomsArray = userRooms.filter(
  //           (room) => room.id !== roomID
  //         );
  //         const filteredRoomMembersArray = roomMembers.filter(
  //           (member) => id !== member.id
  //         );

  //         userRoomList = filteredRoomMembersArray;

  //         transaction.update(userRef, { rooms: filteredRoomsArray });
  //         transaction.update(roomRef, { members: filteredRoomMembersArray });
  //       })
  //       .then(() => {
  //         socket.emit("userRooms", userRoomList);
  //       });
  //   });
  // });

  // Event fires when user disconnects from socket instance.
  // socket.on("disconnecting", () => {
  //   const rooms = Object.keys(socket.rooms);

  //   // use socket.id to find username
  //   const username = getUserFromSocketID(socket.id).name;

  //   // Sends user-disconnect events to rooms user was active in.
  //   rooms.map((room) => {
  //     socket.broadcast
  //       .to(room)
  //       .emit("user-disconnect", { user: username, id: socket.id });
  //     // SEND UPDATED ROOMDATA TO ROOMS
  //     // ...
  //     removeUserFromRoom({ id: socket.id }, room);
  //   });
  //   // remove user from online users
  //   removeUser(socket.id);
  //   const topRooms = getMostPopulousRooms(8);
  //   socket.broadcast.emit("top8Rooms", topRooms);
  // });

  socket.on("disconnect", () => {
    const rooms = Object.keys(socket.rooms);

    // use socket.id to find username
    const disconnectingUser = getUserFromSocketID(socket.id);
    if (disconnectingUser) {
      const username = disconnectingUser.name;

      // Sends user-disconnect events to rooms user was active in.
      rooms.map((room) => {
        socket.broadcast
          .to(room)
          .emit("user-disconnect", { user: username, id: socket.id });
        // SEND UPDATED ROOMDATA TO ROOMS
        // ...
        removeUserFromRoom(disconnectingUser, room);
      });
      // remove user from online users
      removeUser(disconnectingUser.id);
      const topRooms = getMostPopulousRooms(8);
      socket.broadcast.emit("top8Rooms", topRooms);
    }
  });
});
server.listen(process.env.PORT || 5000, () =>
  console.log(`Server has started on port ${process.env.PORT || 5000}.`)
);
