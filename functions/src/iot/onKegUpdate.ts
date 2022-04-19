import moment = require("moment");
import { BeersDrankDataPoint, Keg, kegSizeInfo, User } from "../types";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export default async function (
  message: functions.pubsub.Message,
  _context: functions.EventContext
) {
  const deviceId = message.attributes.deviceId;
  const firestore = functions.app.admin.firestore();

  const buff = Buffer.from(message.data, "base64");
  const stringifyData = buff.toString("ascii");
  console.log("RECEIEVED MESSAGE FROM DEVICE: ", deviceId);
  console.log("RECEIVED MQTT MESSAGE: ", stringifyData);

  try {
    const jsonData = JSON.parse(stringifyData);

    // make sure object has weight and temp
    // and correct types
    if (
      (!jsonData.hasOwnProperty("weight") &&
        typeof jsonData.weight !== "number") ||
      !jsonData.hasOwnProperty("temp") ||
      typeof jsonData.weight !== "number"
    ) {
      return;
    }

    // get reference to kegs document

    const doc = await firestore.collection("kegs").doc(deviceId).get();

    // this device doesnt exist
    if (!doc.exists) {
      console.log("Keg not found!");
      return;
    }

    const firestoreKeg: Keg = doc.data() as Keg;
    console.log(`Found keg ${deviceId}`);

    /* Keg is marked as a potential new keg... Don't do anything */

    if (firestoreKeg.potentialNewKeg) {
      console.log(
        `Keg ${doc.id} is flagged as potential new keg. Skipping update`
      );
      return;
    }

    /* Get the user on this keg */
    const userDoc = await firestore
      .collection("users")
      .doc(firestoreKeg.userId)
      .get();

    // if keg does not belong to user, return
    if (!userDoc.exists) {
      console.log(`No associated user for device: ${deviceId}`);
      return;
    }

    const user: User = userDoc.data() as User;

    // get dates
    const last5Days = getCurrentWeek();
    const last5Weeks = getLast5Weeks();
    const last5Months = getLast5Months();

    // get keg size info from types
    // TODO: Move to collection in firestore for easy updates
    const { full, tare, net_weight } = kegSizeInfo[firestoreKeg.kegSize];

    // check if this is a new Keg
    if (
      (jsonData.weight >= full && firestoreKeg.data.weight <= full / 2) ||
      Math.abs(jsonData.weight - firestoreKeg.data.weight) >= 20
    ) {
      if (!firestoreKeg.acceptNextReading) {
        console.log("Large change in weight. Flagging for potential new keg");

        await admin
          .firestore()
          .collection("kegs")
          .doc(deviceId)
          .update({ potentialNewKeg: true, acceptNextReading: false } as Keg);

        try {
          await sendNotification({
            fcmTokens: user.fcmToken,
            title: "New Keg?",
            keg: firestoreKeg,
            body: `Your ${firestoreKeg.kegSize} of ${firestoreKeg.beerType} showed a large change in weight. If this is a new keg, please reset your scale.`,
          });
        } catch (e) {
          console.log("ERROR SENDING MESSAGE: ", e);
        }

        return;
      }
    }
    // update tare weight if needed
    if (jsonData.weight > full) {
      const customTare = jsonData.weight - full;
      firestoreKeg.data.customTare = customTare;
    } else if (jsonData.weight < tare + firestoreKeg.data.customTare) {
      const customTare = 0;
      firestoreKeg.data.customTare = customTare;
    }

    // percent left
    let percLeft: number = Math.round(
      ((jsonData.weight - (tare + firestoreKeg.data.customTare)) / net_weight) *
        100
    );

    // beers left
    const beersLeft: number = Math.round(
      ((jsonData.weight - (tare + firestoreKeg.data.customTare)) * 16) / 12.6
    );

    // already have a datapoint for today, update it
    const today = last5Days[0];
    const thisWeek = last5Weeks[0];
    const thisMonth = last5Months[0];
    // beers drank
    const beersDrank: number = firestoreKeg.data.beersLeft - beersLeft;
    //  < 0 ? 0: firestoreKeg.data.beersLeft - beersLeft;

    firestoreKeg.data.beersDaily = buildDailyDataset({
      beersDrank: beersDrank,
      currentDataPoint: today,
      next5DataPoints: last5Days,
      trend: firestoreKeg.data.beersDaily,
    });

    firestoreKeg.data.beersDailyArray = buildArrayFromDataset(
      last5Days,
      firestoreKeg.data.beersDaily
    );

    firestoreKeg.data.beersWeekly = buildDailyDataset({
      beersDrank: beersDrank,
      currentDataPoint: thisWeek,
      next5DataPoints: last5Weeks,
      trend: firestoreKeg.data.beersWeekly,
    });
    firestoreKeg.data.beersWeeklyArray = buildArrayFromDataset(
      last5Weeks,
      firestoreKeg.data.beersWeekly
    );

    firestoreKeg.data.beersMonthly = buildDailyDataset({
      beersDrank: beersDrank,
      currentDataPoint: thisMonth,
      next5DataPoints: last5Months,
      trend: firestoreKeg.data.beersMonthly,
    });

    firestoreKeg.data.beersMonthlyArray = buildArrayFromDataset(
      last5Months,
      firestoreKeg.data.beersMonthly
    );

    firestoreKeg.data.percLeft = percLeft;
    firestoreKeg.data.beersLeft = beersLeft;
    firestoreKeg.data.weight = jsonData.weight;
    firestoreKeg.data.temp = jsonData.temp;

    console.log({
      percLeft: (firestoreKeg.data.percLeft = percLeft),
      beersLeft: (firestoreKeg.data.beersLeft = beersLeft),
      weight: (firestoreKeg.data.weight = jsonData.weight),
      temp: (firestoreKeg.data.temp = jsonData.temp),
    });

    if (firestoreKeg.subscribed) {
      // TODO: check if needs notifications
      if (
        firestoreKeg.data.percLeft < firestoreKeg.firstNotificationPerc &&
        !firestoreKeg.data.firstNotificationSent
      ) {
        console.log(
          `PercLeft: ${firestoreKeg.data.percLeft} ${firestoreKeg.firstNotificationPerc}, `
        );
        console.log("SENDING FIRST NOTIFICATION");
        // send first notification
        await sendNotification({
          fcmTokens: user.fcmToken,
          keg: firestoreKeg,
          title: `Your ${firestoreKeg.beerType} keg is low!`,
          body: `Your ${firestoreKeg.kegSize} of ${firestoreKeg.beerType} only has ${firestoreKeg.data.beersLeft} remaining.`,
        });
        firestoreKeg.data.firstNotificationSent = true;
      }

      if (
        firestoreKeg.data.percLeft < firestoreKeg.secondNotificationPerc &&
        !firestoreKeg.data.secondNotificationSent
      ) {
        console.log("SENDING SECOND NOTIFICATION");

        // send second notification
        await sendNotification({
          fcmTokens: user.fcmToken,
          keg: firestoreKeg,
          title: `Your ${firestoreKeg.beerType} keg is low!`,
          body: `Your ${firestoreKeg.kegSize} of ${firestoreKeg.beerType} only has ${firestoreKeg.data.beersLeft} remaining.`,
        });
        firestoreKeg.data.secondNotificationSent = true;
      }
    }

    //   //   // check if notifications need reset

    //   if (
    //     firestoreKeg.firstNotificationPerc > firestoreKeg.data.percLeft &&
    //     firestoreKeg.data.firstNotificationSent
    //   ) {
    //     firestoreKeg.data.firstNotificationSent = false;
    //   }

    //   if (
    //     firestoreKeg.secondNotificationPerc > firestoreKeg.data.percLeft &&
    //     firestoreKeg.data.secondNotificationSent
    //   ) {
    //     firestoreKeg.data.secondNotificationSent = false;
    //   }
    // }

    //set perc left to a number 0-1
    firestoreKeg.data.percLeft = percLeft / 100;

    console.log(
      `Writing new data to device: ${deviceId}, data: ${JSON.stringify(
        firestoreKeg.data
      )}`
    );
    await firestore.collection("kegs").doc(deviceId).set(firestoreKeg);
  } catch (e) {
    console.log(e.message);
  }
}

export function getCurrentWeek(): string[] {
  const dates: string[] = [];

  for (let i = 0; i < 5; i++) {
    const curr = new Date(); // get current date
    const first = curr.getDate() - i; // First day is the day of the month - the day of the week
    const lastday = new Date(curr.setDate(first)).toLocaleDateString();

    dates.push(lastday);
  }
  return dates;
}

export function getLast5Weeks() {
  const today = moment();
  const weeks = [];

  for (let i = 0; i <= 5; i++) {
    if (i === 0) {
      const beginningOfWeek = today.startOf("week").format("MM/DD");
      const endOfWeek = today.endOf("week").format("MM/DD");
      weeks.push(`${beginningOfWeek}-${endOfWeek}`);
    } else {
      const newDate = today.subtract(1, "w");
      const beginningOfWeek = newDate.startOf("week").format("MM/DD");
      const endOfWeek = newDate.endOf("week").format("MM/DD");
      weeks.push(`${beginningOfWeek}-${endOfWeek}`);
    }
  }

  return weeks;
}

export function buildDailyDataset(BuildDataSetArgs: {
  beersDrank: number;
  trend: BeersDrankDataPoint;
  next5DataPoints: string[];
  currentDataPoint: string;
}): BeersDrankDataPoint {
  const { beersDrank, trend, next5DataPoints, currentDataPoint } =
    BuildDataSetArgs;

  //trend = full dataset
  //currentDataPoint = today
  //next5DataPoints = last5Days

  let newTrend;
  if (trend[currentDataPoint]) {
    newTrend = {
      ...trend,
      [currentDataPoint]: trend[currentDataPoint] + beersDrank,
    };
  } else {
    newTrend = {
      ...trend,
      [currentDataPoint]: beersDrank,
    };
  }

  for (const d in newTrend) {
    if (!next5DataPoints.includes(d)) {
      delete newTrend[d];
    }
  }

  return newTrend;
}

export function buildArrayFromDataset(
  dates: string[],
  dailyDataset: BeersDrankDataPoint
): number[] {
  const arr = [];
  dates.forEach((day) => {
    arr.push(dailyDataset[day] || 0);
  });

  return arr;
}

export function getLast5Months() {
  const today = moment();
  const months = [];

  for (let i = 0; i <= 4; i++) {
    if (i === 0) {
      months.push(today.format("MMM"));
    } else {
      const mn = today.subtract(1, "M").format("MMM");
      months.push(mn);
    }
  }
  return months;
}

async function sendNotification(NotificationArgs: {
  fcmTokens: string[];
  keg: Keg;
  title: string;
  body: string;
}) {
  const messaging = functions.app.admin.messaging();
  const result = await messaging.sendToDevice(
    NotificationArgs.fcmTokens,
    {
      notification: {
        title: NotificationArgs.title,
        body: NotificationArgs.body,
        sound: "default",
      },
    },
    {
      priority: "high",
      contentAvailable: true,
    }
  );

  if (result.failureCount > 0) {
    result.results.forEach((result) => {
      console.log(
        `Messaging Error: ${result.error.message}, ${result.error.code} for token: ${result.canonicalRegistrationToken}`
      );
    });
  }
}

function getFirstAndLastDayOfWeek(): string[] {
  const weeks = [];

  for (let i = 6; i <= 30; i += 6) {
    const curr = new Date();
    const first = curr.getDate() - curr.getDay(); // First day is the day of the month - the day of the week
    const last = first + i; // last day is the first day + 6

    const firstday = new Date(curr.setDate(first)).toLocaleDateString();
    const lastday = new Date(curr.setDate(last)).toLocaleDateString();
    weeks.push(`${firstday}-${lastday}`);
  }
  return weeks;
}
