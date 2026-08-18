import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf-8"));
const app = initializeApp({ projectId: config.projectId });

console.log("Initialized auth with project:", app.options.projectId);
