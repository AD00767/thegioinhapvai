import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
const app = initializeApp({ projectId: "gen-lang-client-0874806954" });
console.log(app.options.projectId);
try {
  await getAuth(app).verifyIdToken("fake-token");
} catch(e) {
  console.log(e.message);
}
