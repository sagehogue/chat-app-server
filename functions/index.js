const functions = require("firebase-functions");

const algoliasearch = require("algoliasearch");
// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions

// TODOS
//
// 1) Write functions to update both the rooms and users indices. They can both be updated in the DB and the index needs to be kept up to date.

const ALGOLIA_ID = functions.config().algolia.app_id;
const ALGOLIA_ADMIN_KEY = functions.config().algolia.api_key;
const ALGOLIA_SEARCH_KEY = functions.config().algolia.search_key;

const client = algoliasearch(ALGOLIA_ID, ALGOLIA_ADMIN_KEY);

const roomIndex = client.initIndex("room_search");
const userIndex = client.initIndex("user_search");

exports.indexRoom = functions.firestore
  .document("/rooms/{roomID}")
  .onCreate((snap, context) => {
    // Get the note document
    const room = snap.data();

    // Add an 'objectID' field which Algolia requires
    room.objectID = context.params.roomID;
    return roomIndex.saveObject(room);
  });

exports.unindexRoom = functions.firestore
  .document("/rooms/{roomID}")
  .onDelete((snap, context) => {
    const objectID = context.params.roomID;
    return roomIndex.deleteObject(objectID);
  });

exports.indexUser = functions.firestore
  .document("/users/{id}")
  .onCreate((snap, context) => {
    const user = snap.data();
    user.objectID = context.params.id;
    return userIndex.saveObject(user);
  });

exports.unindexUser = functions.firestore
  .document("/users/{id}")
  .onDelete((snap, context) => {
    const objectID = context.params.id;
    return userIndex.deleteObject(objectID);
  });
