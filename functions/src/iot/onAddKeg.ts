import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Keg } from "../types";
import {
  buildArrayFromDataset,
  buildDailyDataset,
  getCurrentWeek,
  getLast5Months,
  getLast5Weeks,
} from "./onKegUpdate";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export const addKeg = async (
  data: any,
  context: functions.https.CallableContext
) => {
  console.log(data, context.auth);
  if (!context.auth) {
    // Throwing an HttpsError so that the client gets the error details.
    throw new functions.https.HttpsError(
      "failed-precondition",
      "The function must be called  while authenticated."
    );
  }

  const uid = context.auth.uid;
  const foundDevice = await admin
    .firestore()
    .collection("devices")
    .doc(String(data.id).toLowerCase())
    .get();

  if (!foundDevice.exists) {
    throw new functions.https.HttpsError(
      "cancelled",
      "The requested device does not exist"
    );
  }

  const kegClaimed = (
    await admin.firestore().collection("kegs").doc(data.id).get()
  ).exists;

  if (kegClaimed) {
    throw new functions.https.HttpsError("cancelled", "Keg is already claimed");
  }

  const { id } = data;
  delete data.id;

  const keg: Keg = {
    ...data,
    userId: uid,
    online: false,
    createdAt: Date.now(),
    potentialNewKeg: false,
    acceptNextReading: false,
    data: {
      customTare: 0,
      beersLeft: 0,
      percLeft: 0,
      weight: 0,
      temp: 0,
      beersToday: 0,
      beersDaily: {},
      beersDailyArray: [0, 0, 0, 0, 0],
      beersThisWeek: 0,
      beersWeekly: {},
      beersWeeklyArray: [0, 0, 0, 0, 0],
      beersThisMonth: 0,
      beersMonthly: {},
      beersMonthlyArray: [0, 0, 0, 0, 0],
      firstNotificationSent: false,
      secondNotificationSent: false,
    },
  } as Keg;

  console.log(keg);

  return await admin.firestore().collection("kegs").doc(id).set(keg);
};
