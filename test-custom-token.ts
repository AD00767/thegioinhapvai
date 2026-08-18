import { initializeApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { initializeApp as initClientApp } from "firebase/app";
import { getAuth as getClientAuth, signInWithCustomToken } from "firebase/auth";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf-8"));
const adminApp = initializeApp({ projectId: config.projectId });
const adminAuth = getAdminAuth(adminApp);

const clientApp = initClientApp(config);
const clientAuth = getClientAuth(clientApp);

async function run() {
  try {
    const customToken = await adminAuth.createCustomToken("test-uid-123");
    console.log("Custom token created!");
    const userCredential = await signInWithCustomToken(clientAuth, customToken);
    console.log("Signed in as:", userCredential.user.uid);
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
