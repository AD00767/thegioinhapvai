import fs from "fs";

const config = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf-8"));
const projectId = config.projectId;
const databaseId = config.firestoreDatabaseId;

async function run() {
  // We don't have a real ID token here, but we can try without one to see the error.
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/characters`;
  console.log("Fetching:", url);
  const res = await fetch(url);
  const data = await res.json();
  console.log("Response:", JSON.stringify(data, null, 2));
}
run();
