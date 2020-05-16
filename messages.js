// Takes a firebase firestore instance, a message object, and a room name string
const addMessageToRoom = async ({ db, message, roomName }) => {
  roomsRef = db.collection("rooms");
  let roomPreviouslyExisted;
  roomRef = roomsRef.get(roomName).then((doc) => {
    if (doc.exists) {
      console.log("Document data:", doc.data());
      roomPreviouslyExisted = true;
      // Implement message adding
    } else {
      // doc.data() will be undefined in this case
      // Implement room creation
      console.log("No such document!");
      roomPreviouslyExisted = false;
      const data = {
        messageHistory: [message],
      };
      roomsRef.doc(roomName).set(data);
    }
  });
};

const getMessageHistory = async ({ db, roomName }) => {
  roomsRef = db.collection("rooms");
  roomRef = roomsRef.get(roomName).then((doc) => {
    if (doc.exists) {
      console.log("Document data:", doc.data().messageHistory);
      return { messages: doc.data().messageHistory };
    } else {
      return { error: "Room not found." };
    }
  });
};

module.exports = { addMessageToRoom, getMessageHistory };
