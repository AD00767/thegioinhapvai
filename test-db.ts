import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

let app;
let databaseId = "(default)";
const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
let projectId = "gen-lang-client-0874806954"; // fallback
if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  if (config.projectId) projectId = config.projectId;
  if (config.firestoreDatabaseId) databaseId = config.firestoreDatabaseId;
}
app = initializeApp({ projectId });
const db = getFirestore(app, databaseId);

async function run() {
  try {
    const snapshot = await db.collection("characters").where("deletedAt", "==", null).orderBy("createdAt", "desc").limit(20).get();
    console.log("Characters:", snapshot.docs.length);
  } catch(e) {
    console.error("Query Error:", e.message);
  }
}
run();
