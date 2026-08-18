import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";
import path from "path";

let app;
let databaseId = "(default)";

// Firebase Admin initialization
if (!getApps().length) {
  try {
     const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
     let projectId = "gen-lang-client-0874806954"; // fallback
     if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        if (config.projectId) projectId = config.projectId;
        if (config.firestoreDatabaseId) databaseId = config.firestoreDatabaseId;
     }
     app = initializeApp({ projectId });
  } catch (e) {
     console.error("Firebase admin init failed", e);
     app = initializeApp();
  }
} else {
  app = getApp();
}

export const db = getFirestore(app, databaseId);
export const auth = getAuth(app);
export { FieldValue };
