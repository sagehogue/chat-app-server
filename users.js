// array of online users
const users = [];

// Method to add a new user to the array of online users
const addUser = ({ id, name, room }) => {
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

module.exports = { addUser, removeUser, getUser, getUsersInRoom };
