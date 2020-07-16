const util = require('util')

// TODOS
// 
// 1) Implement status feature
// -- on connect, add user to online user array
// -- on join, check if room exists, add user to room, update user status
// -- on room disconnect, update user status, remove user, remove room if empty
// 2) Handle reconnections


// array of online users
const users = [];

// array of active rooms
const rooms = [];

const addRoomOrIncrementOnlineUsers = (room) => {
  console.log(room)
  room = room.trim().toLowerCase();
  const existingRoom = rooms.find((onlineRoom) => onlineRoom.roomName === room);
  // some custom errors
  if (existingRoom) {
    existingRoom.online++
    console.log('Users online: ' + existingRoom.online)
    return existingRoom.online
  } else {
    const newRoom = { roomName: room, online: 1 }
    rooms.push(newRoom)
    console.log('Users online: ' + newRoom.online)
    return newRoom.online;
  }
};

const decrementOnlineUsers = (room) => {
  console.log(`Room to decrement: ${room}\n Active Rooms: ${util.inspect(rooms, { showHidden: false, depth: null })}`)
  room = room.trim().toLowerCase();
  const existingRoom = rooms.find((onlineRoom) => onlineRoom.roomName === room);
  if (existingRoom) {
    if (existingRoom.online > 1) {
      existingRoom.online--
      console.log("Online: " + existingRoom.online)
      return existingRoom.online
    } else {
      let index = rooms.findIndex(onlineRoom => onlineRoom.roomName === room)
      rooms.splice(index, 1)
      console.log("Online: 0")
      return 0
    }
  }
};

// Method to add a new user to the array of online users
const addUser = ({ id, name, room = false }) => {
  // ID is unique and is compared against to find the user.
  // name is display name, room is the room they are currently in.
  console.log(id, name, room)
  name = name.trim().toLowerCase();
  if (room) {
    room = room.trim().toLowerCase();
  }

  // searches for existing 
  const existingUser = users.find(
    (user) => user.room === room && user.name === name
  );

  // some custom errors
  // if (!name || !room) return { error: "Username and room are required." };
  // if (existingUser) return { error: "Username is taken." };
  // new user object created from our arguments
  const user = { id, name, room };
  // add it to the array of online users
  users.push(user);
  console.log(user);

  // return user object if it was successfully addded to the list.
  return { user };
};


// Method to add a new user to the array of online users
const oldaddUser = ({ id, name, room }) => {
  // ID is unique and is compared against to find the user.
  // name is display name, room is the room they are currently in.
  console.log(id, name, room)
  name = name.trim().toLowerCase();
  room = room.trim().toLowerCase();

  // returns user object from users array that matches name and room arguments
  const existingUser = users.find(
    (user) => user.room === room && user.name === name
  );

  // some custom errors
  if (!name || !room) return { error: "Username and room are required." };
  if (existingUser) return { error: "Username is taken." };
  // new user object created from our arguments
  const user = { id, name, room };
  // add it to the array of online users
  users.push(user);
  console.log(user);

  // return user object if it was successfully addded to the list.
  return { user };
};

const removeUser = (id) => {
  // takes user id, finds user object in list of online users, 
  const index = users.findIndex((user) => user.id === id);
  console.log('removeUser ' + id)
  if (index !== -1) return users.splice(index, 1)[0];
};

const getUser = (id) => users.find((user) => user.id === id);

const getUsersInRoom = (room) => users.filter((user) => user.room === room);

module.exports = { addUser, removeUser, getUser, getUsersInRoom, addRoomOrIncrementOnlineUsers, decrementOnlineUsers };
