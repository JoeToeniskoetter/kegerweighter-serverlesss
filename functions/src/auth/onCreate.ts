import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export default async function(
    user: admin.auth.UserRecord,
    _context: functions.EventContext
) {
  await admin.firestore().collection("users").doc(user.uid).create({
    uid: user.uid,
    email: user.email,
    photoUrl: user.photoURL,
    fcmToken: [],
    role: "USER",
  });
}
