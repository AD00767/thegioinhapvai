import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const app = initializeApp({ projectId: "gen-lang-client-0874806954" });
console.log("App initialized with projectId:", app.options.projectId);
// We don't have a token right now, but we can see if it initializes properly.
