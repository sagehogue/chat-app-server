const util = require("util");

// TODOS
//
// 1) Implement status feature
// 2) Handle reconnections
// 3) Allow users to change room status - currently out of sync with FE state

// array of online users
// user obj looks like { id, name, room }
const users = [];
const rooms = [];
// actually managing the online user count by looping through online users
// checking what type room they're in. not tracking online users through
// object property anymore.

// Increments online user count or creates a new room in the online room array if given room is new.
const addRoomOrIncrementOnlineUsers = (room) => {
  room = room.trim().toLowerCase();
  const existingRoom = rooms.find((onlineRoom) => onlineRoom.roomName === room);
  // some custom errors
  if (existingRoom) {
    existingRoom.online++;
    console.log("Users online: " + existingRoom.online);
    return existingRoom.online;
  } else {
    const newRoom = { roomName: room, online: 1 };
    rooms.push(newRoom);
    console.log("Users online: " + newRoom.online);
    return newRoom.online;
  }
};

// Decrements online user count of a given room. Removes room if empty after decrementing.
const decrementOnlineUsers = (room) => {
  room = room.trim().toLowerCase();
  console.log(
    `Room to decrement: ${room}\n Active Rooms: ${util.inspect(rooms, {
      showHidden: false,
      depth: null,
    })}`
  );
  const existingRoom = rooms.find((onlineRoom) => onlineRoom.roomName === room);
  if (existingRoom) {
    if (existingRoom.online >= 2) {
      existingRoom.online--;
      console.log("Online: " + existingRoom.online);
      return existingRoom.online;
    } else {
      let index = rooms.findIndex((onlineRoom) => onlineRoom.roomName === room);
      rooms.splice(index, 1);
      return 0;
    }
  }
};

// Method to add a new user to the array of online users
const addUser = ({ id, name, room = false }) => {
  // ID is unique and is compared against to find the user.
  // name is display name, room is the room they are currently in.
  name = name.trim().toLowerCase();
  if (room) {
    room = room.trim().toLowerCase();
  }

  // searches for existing
  const existingUser = users.find(
    (user) => user.room === room && user.name === name
  );

  // new user object created from our arguments
  const user = { id, name, room };

  // add it to the array of online users
  users.push(user);

  // return user object if it was successfully addded to the list.
  return { user };
};

const changeUserLocation = ({ id, newRoom }) => {
  const index = users.findIndex((user) => user.id === id);
  if (index !== -1) {
    users[index].room = newRoom;
    console.log("Changed room of user " + id + " to " + newRoom);
    console.log(users[index]);
  }
};

const removeUser = (id) => {
  // takes user id, finds user object in list of online users,
  const index = users.findIndex((user) => user.id === id);
  console.log("removeUser " + id);
  if (index !== -1) return users.splice(index, 1)[0];
};

const getUser = (id) => users.find((user) => user.id === id);

module.exports = {
  addUser,
  removeUser,
  getUser,
  addRoomOrIncrementOnlineUsers,
  decrementOnlineUsers,
  changeUserLocation,
};
