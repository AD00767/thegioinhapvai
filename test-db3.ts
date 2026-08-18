import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

let databaseId = "(default)";
const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
let projectId = "gen-lang-client-0874806954"; 
if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  if (config.projectId) projectId = config.projectId;
  if (config.firestoreDatabaseId) databaseId = config.firestoreDatabaseId;
}

const appA = initializeApp({ projectId }, "appA");
const dbA = getFirestore(appA, databaseId);

async function run() {
  try {
    const snapA = await dbA.collection("characters").limit(1).get();
    console.log("AppA success", snapA.docs.length);
  } catch(e) {
    console.error("AppA Error:", e.message);
  }
  process.exit(0);
}
run();
