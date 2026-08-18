import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, limit, query } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  try {
    const snap = await getDocs(query(collection(db, "characters"), limit(1)));
    console.log("Client Success", snap.docs.length);
  } catch(e) {
    console.error("Client Error", e);
  }
}
run();
