const functions = require("firebase-functions");
const admin = require("firebase-admin");

const algoliasearch = require("algoliasearch");
// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

const ALGOLIA_ID = functions.config().algolia.app_id;
const ALGOLIA_ADMIN_KEY = functions.config().algolia.api_key;
const ALGOLIA_SEARCH_KEY = functions.config().algolia.search_key;

admin.initializeApp();
const env = functions.config();
const client = algoliasearch(ALGOLIA_ID, ALGOLIA_ADMIN_KEY);

const roomIndex = client.initIndex("room_search");
const userIndex = client.initIndex("user_search");

exports.indexRoom = functions.firestore
  .document("/rooms/{id}")
  .onCreate((snap, context) => {
    const data = snap.data();
    const objectId = snap.id;
    const object = { objectId, ...data };
    return roomIndex.addObject(object);
  });

exports.unindexRoom = functions.firestore
  .document("/rooms/{id}")
  .onDelete((snap, context) => {
    const objectId = snap.id;
    return roomIndex.deleteObject(objectId);
  });

exports.indexUser = functions.firestore
  .document("/users/{id}")
  .onCreate((snap, context) => {
    const data = snap.data();
    const objectId = snap.id;
    return userIndex.addObject({ objectId, ...data });
  });

exports.unindexUser = functions.firestore
  .document("/users/{id}")
  .onDelete((snap, context) => {
    const objectId = snap.id;
    return userIndex.deleteObject(objectId);
  });
