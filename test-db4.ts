import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf-8"));
const databaseId = config.firestoreDatabaseId;

const app = initializeApp();
const db = getFirestore(app, databaseId);

async function run() {
  try {
    const snap = await db.collection("characters").limit(1).get();
    console.log("Success! Docs:", snap.docs.length);
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
