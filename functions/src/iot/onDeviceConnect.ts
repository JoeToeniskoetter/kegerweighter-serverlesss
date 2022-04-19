import * as admin from "firebase-admin";
import { Device, DevicesMetaData } from "../types";
import * as iot from "@google-cloud/iot";
const iotClient = new iot.v1.DeviceManagerClient();

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export const onIOTConnect = async (message) => {
  const logEntry = JSON.parse(Buffer.from(message.data, "base64").toString());
  const deviceId = logEntry.labels.device_id;

  console.log("DEVICE: ", deviceId, " HAS: ", logEntry.jsonPayload.eventType);

  let online: boolean;

  switch (logEntry.jsonPayload.eventType) {
    case "CONNECT":
      online = true;
      break;
    case "DISCONNECT":
      online = false;
      break;
    default:
      throw new Error("Invalid event from IOT Connect state topic");
  }

  const docRef = admin.firestore().collection("kegs").doc(deviceId);

  try {
    docRef.update({ online });
  } catch (e) {
    console.error(`${deviceId} not registered with this registry`);
  }
};
