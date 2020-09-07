// TODOS:
// Implement better user tracking - need to be able to list all users present in each room.

// array of active rooms
// room obj looks like { roomName: room, online: count }
const rooms = [];

const addRoom = (roomName, user = false) => {
  roomName = roomName.trim().toLowerCase();
  const existingRoom = rooms.find((onlineRoom) => onlineRoom.roomName === room);
  if (existingRoom) {
    return existingRoom;
  } else {
    const newRoom = { roomName: room, online: 1, users: [] };
    // if user is provided, user is added to room's userlist
    if (user) {
      newRoom.users.push(user);
    }
    rooms.push(newRoom);
    console.log("Users online: " + newRoom.online);
    return newRoom;
  }
};

// Adds user too room and increments online user count
const addUserToRoom = (user, room) => {
  // searches for room
  const roomToAddUserTo = rooms.find(
    (onlineRoom) => onlineRoom.roomName === room
  );

  // add it to the array of online users in given room
  roomToAddUserTo.users.push(user);

  roomToAddUserTo.online++;

  // return room user was added to.
  return { roomToAddUserTo };
};

//  remove user from room and decrements online user count. Removes room if no users are active.
const removeUserFromRoom = (user, room) => {
  // finds room
  const roomToRemoveUserFrom = rooms.find(
    (onlineRoom) => onlineRoom.roomName === room
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
      let index = rooms.findIndex((onlineRoom) => onlineRoom.roomName === room);
      rooms.splice(index, 1);
      return 0;
    }
  }
};

module.exports = {
  addRoom,
  removeUserFromRoom,
  addUserToRoom,
};
