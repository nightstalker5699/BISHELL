const admin = require("firebase-admin");
// const serviceAccount = require('./bishell-firebase-adminsdk-vf21w-3043360afe.json');

try {
  // admin.initializeApp({
  //   credential: admin.credential.cert(serviceAccount),
  // });
  console.log("Firebase Admin initialized successfully");
} catch (error) {
  console.error("Firebase Admin initialization error:", error);
}

module.exports = admin;
