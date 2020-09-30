const util = require("util");

// TODOS
//
// 1) Implement status feature
// 2) Handle reconnections

// array of online users. user obj looks like { id, name, room }
const users = [];

// Method to add a new user to the array of online users
// name is display name, room is the room they are currently in.
const addUser = ({ id, socket, name, room = false }) => {
  // searches for existing
  existingUser = false;
  existingUser = users.find((user) => user.id === id);

  if (existingUser) {
    existingUser.socket = socket;
    return existingUser;
  } else {
    // new user object created from our arguments
    const user = { id, name, room, socket };

    // add it to the array of online users
    users.push(user);

    // return user object if it was successfully addded to the list.
    return user;
  }
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
  changeUserLocation,
};
