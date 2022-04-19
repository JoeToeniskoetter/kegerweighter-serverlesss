import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Keg, kegSizeInfo, ResetKegInput } from "../types";
import { buildArrayFromDataset, buildDailyDataset } from "./onKegUpdate";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export const onKegReset = async (
  data,
  context: functions.https.CallableContext
) => {
  if (!context.auth) {
    // Throwing an HttpsError so that the client gets the error details.
    throw new functions.https.HttpsError(
      "failed-precondition",
      "The function must be called  while authenticated."
    );
  }

  const { id, clearData } = data as ResetKegInput;
  console.log(`Reseting keg with id: ${id}, clear data ${clearData}`);
  const uid = context.auth.uid;

  const kegDocRef = admin.firestore().collection("kegs").doc(id);

  const foundKeg = await kegDocRef.get();
  const foundKegData = foundKeg.data() as Keg;

  if (!foundKeg.exists) {
    throw new functions.https.HttpsError("not-found", "keg not found");
  }

  if (foundKegData.userId !== uid) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Unauthorized to perform this action"
    );
  }

  if (clearData === false) {
    return await kegDocRef.update({
      potentialNewKeg: false,
      acceptNextReading: true,
    } as Keg);
  }

  return await kegDocRef.update({
    data: {
      ...foundKegData.data,
      customTare: 0,
      beersLeft: kegSizeInfo[foundKegData.kegSize].beers,
      beersToday: 0,
      beersDaily: {},
      beersDailyArray: [0, 0, 0, 0, 0],
      beersThisWeek: 0,
      beersWeekly: {},
      beersWeeklyArray: [0, 0, 0, 0, 0],
      beersThisMonth: 0,
      beersMonthly: {},
      beersMonthlyArray: [0, 0, 0, 0, 0],
      percLeft: 1,
      weight: kegSizeInfo[foundKegData.kegSize].full,
    },
    potentialNewKeg: false,
    acceptNextReading: false,
  } as Keg);
};
