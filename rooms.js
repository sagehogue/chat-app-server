const util = require("util");

// TODOS:
// ***MOST IMPORTANT*** Replace all references to rooms by names with references by ID!!!
// Implement better user tracking - need to be able to list all users present in each room.
// Need to calculate the most populated rooms - perhaps a func like determineMostPopulatedRooms can run after each
// user join/leave and I can create a second array populated with the results. Then clients can request the array
// when they boot up the join component.

// array of active rooms
// room obj looks like { roomName: room, online: count }
const rooms = [];

// room expected to look like {roomID: id, roomName: name}
const addRoom = (room, user = false) => {
  console.log("ADDROOM ROOM & USER " + util.inspect(room, user));
  const { roomName, id } = room;
  console.log(
    `\n*****\n*****\n${util.inspect(room, {
      showHidden: false,
      depth: null,
    })}\n********\n******`
  );
  const existingRoom = rooms.find((onlineRoom) => onlineRoom.id === id);
  if (existingRoom) {
    return "Error! Room already online!\n" + existingRoom;
  } else {
    const newRoom = { roomName: roomName, id, online: 1, users: [] };
    // if user is provided, user is added to room's userlist
    if (user) {
      newRoom.users.push(user);
    }
    rooms.push(newRoom);
    console.log("Users online: " + newRoom.online);
    return newRoom;
  }
};

// Adds user to room and increments online user count
// room expected to look like {roomID: id, roomName: name}
const addUserToRoom = (user, room) => {
  console.log("Room OBJ in addUserToRoom: " + util.inspect(room));
  // searches for room
  const roomToAddUserTo = rooms.find((onlineRoom) => onlineRoom.id === room.id);
  if (roomToAddUserTo) {
    // add it to the array of online users in given room
    roomToAddUserTo.users.push(user);

    roomToAddUserTo.online++;

    // return room user was added to.
    return roomToAddUserTo;
  } else {
    return addRoom(room, user);
  }
};

// takes a roomID, returns information about it
const getRoomInfo = (roomID) => {
  const data = rooms.filter((activeRoom) => activeRoom.id === roomID);
  console.log(`Room Data: ${data[0]}`);
  return data[0];
};

// Retrieves the given quantity of most populated rooms
const getMostPopulousRooms = (quantity) => {
  rooms.sort((a, b) => b.online - a.online);
  const dupeArray = [...rooms];
  let mostPopulated = dupeArray.splice(0, quantity);
  console.log(mostPopulated);
  return mostPopulated;
};

//  remove user from room and decrements online user count. Removes room if no users are active.
const removeUserFromRoom = (user, room) => {
  const { roomName, id } = room;
  const roomID = id;
  // finds room
  const roomToRemoveUserFrom = rooms.find(
    (onlineRoom) => onlineRoom.id === roomID
  );
  if (roomToRemoveUserFrom) {
    // if more than 1 user in room, count is decremented, user removed
    if (roomToRemoveUserFrom.online >= 2) {
      let index = roomToRemoveUserFrom.users.findIndex(
        (userInRoom) => userInRoom.id === user.id
      );
      roomToRemoveUserFrom.users.splice(index, 1);
      roomToRemoveUserFrom.online--;
      return roomToRemoveUserFrom;
      // only 1 user? removed room from list of active rooms entirely.
    } else {
      let index = rooms.findIndex((onlineRoom) => onlineRoom.id === roomID);
      rooms.splice(index, 1);
      return 0;
    }
  }
};

module.exports = {
  addRoom,
  removeUserFromRoom,
  addUserToRoom,
  getRoomInfo,
  getMostPopulousRooms,
};
