import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const onFirmwareUpload = async (
  object: functions.storage.ObjectMetadata,
  _context: functions.EventContext
) => {
  console.log(`Received new firmware ${object.name}`);
  const firmwareFileRef = admin.storage().bucket().file(object.name);
  const objRef = await firmwareFileRef.download();
  // const [downloadLink] = await firmwareFileRef.getSignedUrl({
  //   action: "read",
  //   expires: "03-09-2491",
  // });
  const downloadLink =
    "https://us-central1-kegerweighter.cloudfunctions.net/firmwareDownload";
  const version = objRef
    .toString()
    .split("__FIRMWARE_VERSION__")[1]
    .split("__")[0];

  console.log(`New firmware ${version}`);
  const metaDataDocRef = admin
    .firestore()
    .collection("devicesMetadata")
    .doc("latest");

  await metaDataDocRef.set({
    firmwareLink: downloadLink,
    updatedAt: admin.firestore.Timestamp.now(),
    latestFirmwareVersion: version,
  });
};

export default onFirmwareUpload;
