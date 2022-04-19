import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as iot from "@google-cloud/iot";
import { DevicesMetaData } from "../types";
const iotClient = new iot.v1.DeviceManagerClient();

export default async (
  message: functions.pubsub.Message,
  context: functions.EventContext
) => {
  const deviceId = message.attributes.deviceId;
  const firestore = functions.app.admin.firestore();

  const buff = Buffer.from(message.data, "base64");
  const stringifyData = buff.toString("ascii");

  const deviceRef = firestore.collection("devices").doc(deviceId);

  const deviceDoc = deviceRef.get();

  if (!(await deviceDoc).exists) {
    throw new Error(
      `Firmware version update failed. ${deviceId} does not exist`
    );
  }

  try {
    const firmwareVersion = stringifyData
      .split("__FIRMWARE_VERSION__")[1]
      .split("__")[0];
    await deviceRef.update({ firmwareVersion });
    await checkFirmwareNeedsUpdate(deviceId, firmwareVersion);
  } catch (e) {
    console.log(
      `Unable to update device ${deviceId}'s firmware version to ${stringifyData}`
    );
  }
};

const checkFirmwareNeedsUpdate = async (
  deviceId: string,
  firmwareVersion: string
) => {
  const formattedName = iotClient.devicePath(
    "kegerweighter",
    "us-central1",
    "main",
    deviceId
  );

  const newFirmwareVersion = await admin
    .firestore()
    .collection("devicesMetadata")
    .doc("latest")
    .get();

  if (!newFirmwareVersion.exists) {
    throw new Error(`could not find latest firmware version doc`);
  }

  if (!newFirmwareVersion.data().firmwareLink) {
    throw new Error("could not find latest firmware link");
  }

  const { firmwareLink, latestFirmwareVersion } =
    newFirmwareVersion.data() as DevicesMetaData;

  if (firmwareVersion == latestFirmwareVersion) {
    console.log(`Device ${deviceId}'s firmware is up to date.`);
    return;
  }

  const binaryData = Buffer.from(`OTA:${firmwareLink}`);

  console.log(
    `Device: ${deviceId} with firmware version ${firmwareVersion} needs update. Sending firmware version ${latestFirmwareVersion}, link: ${firmwareLink}`
  );
  console.log(`Device path ${formattedName}`);

  const request: iot.protos.google.cloud.iot.v1.ISendCommandToDeviceRequest = {
    name: formattedName,
    binaryData: binaryData,
  };

  const [response] = await iotClient.sendCommandToDevice(request);
  console.log("Sent command: ", response);
};
