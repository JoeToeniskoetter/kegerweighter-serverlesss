import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { PubSub } from "@google-cloud/pubsub";
import onCreate from "./auth/onCreate";
import IOTUpdate from "./iot/onKegUpdate";
import { Keg } from "./types";
import { addKeg as onAddKeg } from "./iot/onAddKeg";
import { onKegReset } from "./iot/onKegReset";
import { onIOTConnect } from "./iot/onDeviceConnect";
import firmwareUpload from "./iot/onFirmwareUpload";
import firmwareMessage from "./iot/onFirmwareVersionMessage";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Instantiates a client
// const pubsub = new PubSub();

export const onAuthCreated = functions.auth.user().onCreate(onCreate);
export const addKeg = functions.https.onCall(onAddKeg);
export const resetKeg = functions.https.onCall(onKegReset);
export const onDeviceConnect = functions.pubsub
  .topic("online-state")
  .onPublish(onIOTConnect);
export const onKegUpdate = functions.pubsub
  .topic("update")
  .onPublish(IOTUpdate);
export const onFirmwareUpload = functions.storage
  .bucket()
  .object()
  .onFinalize(firmwareUpload);
export const onFirmwareVersionMessage = functions.pubsub
  .topic("firmware-version")
  .onPublish(firmwareMessage);
export const firmwareDownload = functions.https.onRequest(
  async (req: functions.https.Request, resp: functions.Response<any>) => {
    const firmwareRef = admin.storage().bucket().file("firmware.bin");
    const data = firmwareRef.createReadStream();
    data.pipe(resp);
  }
);
// export const testKegUpdate = functions.https.onCall(
//   async (data: any, context: functions.https.CallableContext) => {
//     const topic = pubsub.topic("update");

//     const messageData = data;
//     const messageBuffer = Buffer.from(JSON.stringify(messageData), "utf8");

//     // Publishes a message
//     try {
//       await topic.publish(messageBuffer, { deviceId: "esp-8266-test" });
//       return { message: "Message published." };
//     } catch (err) {
//       console.error(err);
//       return { message: err };
//     }
//   }
// );
export const onPublish = functions.pubsub
  .topic("atest-pub")
  .onPublish(onKegUpdate);

// export const seedData = functions.https.onRequest(
//   async (req: functions.https.Request, resp: functions.Response<any>) => {
//     await seedTestData("test");
//     resp.json({ message: "ok" });
//   }
// );

// export async function seedTestData(userId: string) {
//   const keg: Keg = {
//     acceptNextReading: true,
//     beerType: "test",
//     location: "test",
//     kegSize: "1/2 Barrel",
//     firstNotificationPerc: 10,
//     secondNotificationPerc: 10,
//     subscribed: false,
//     userId: "test",
//     data: {
//       customTare: 10,
//       beersLeft: 10,
//       percLeft: 10,
//       weight: 10,
//       temp: 10,
//       beersToday: 10,
//       beersDaily: {},
//       beersDailyArray: [],
//       beersThisWeek: 10,
//       beersWeekly: {},
//       beersWeeklyArray: [],
//       beersThisMonth: 10,
//       beersMonthlyArray: [],
//       beersMonthly: {},
//       firstNotificationSent: false,
//       secondNotificationSent: false,
//     },
//     online: false,
//     potentialNewKeg: false,
//     createdAt: Date.now(),
//   };

//   await admin.firestore().collection("kegs").doc("esp-8266-test").set(keg);
// }

// export const kegs = functions.https.onRequest(async (req, res) => {
//   res.json({
//     beerType: "test",
//     location: "test",
//     kegSize: "1/2 Barrel",
//     firstNotificationPerc: 10,
//     secondNotificationPerc: 10,
//     subscribed: false,
//     userId: "test",
//     data: {
//       customTare: 10,
//       beersLeft: 10,
//       percLeft: 10,
//       weight: 10,
//       temp: 10,
//       beersToday: 10,
//       beersDaily: {},
//       beersDailyArray: [],
//       beersThisWeek: 10,
//       beersWeekly: {},
//       beersWeeklyArray: [],
//       beersThisMonth: 10,
//       beersMonthlyArray: [],
//       beersMonthly: {},
//       firstNotificationSent: false,
//       secondNotificationSent: false,
//     },
//     online: false,
//     potentialNewKeg: false,
//     createdAt: Date.now(),
//   });
// });
