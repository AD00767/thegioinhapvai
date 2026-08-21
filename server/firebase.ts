import { initializeApp as initAdminApp, getApps as getAdminApps, getApp as getAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { initializeApp as initWebApp } from "firebase/app";
import { 
  getFirestore as getWebFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit as limitFn, 
  serverTimestamp as webServerTimestamp,
  increment as webIncrement,
  deleteField as webDeleteField
} from "firebase/firestore";
import fs from "fs";
import path from "path";

// 1. Read config
const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
let config: any = {};
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (e) {
    console.error("Failed to parse firebase-applet-config.json", e);
  }
}

const projectId = config.projectId || "gen-lang-client-0846431640";
const databaseId = config.firestoreDatabaseId || "(default)";

// 2. Initialize Firebase Admin App (for JWT Auth verification)
let adminApp;
if (!getAdminApps().length) {
  adminApp = initAdminApp({ projectId });
} else {
  adminApp = getAdminApp();
}
export const auth = getAdminAuth(adminApp);

// 3. Initialize Web Firebase App & Firestore (uses API Key for reliable database access)
const webApp = initWebApp({
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId
});
const rawFirestore = getWebFirestore(webApp, databaseId);

// 4. Create FieldValue helpers matching Admin SDK
export const FieldValue = {
  serverTimestamp: () => ({ _sentinelName: "serverTimestamp" }),
  increment: (n: number) => ({ _sentinelName: "increment", _value: n }),
  delete: () => ({ _sentinelName: "delete" })
};

function sanitizeData(data: any) {
  if (!data || typeof data !== "object") return data;
  const copy: any = Array.isArray(data) ? [...data] : { ...data };
  for (const k in copy) {
    const val = copy[k];
    if (val && typeof val === "object") {
      if (val._sentinelName === "serverTimestamp") {
        copy[k] = webServerTimestamp();
      } else if (val._sentinelName === "increment") {
        copy[k] = webIncrement(val._value);
      } else if (val._sentinelName === "delete") {
        copy[k] = webDeleteField();
      } else {
        copy[k] = sanitizeData(val);
      }
    }
  }
  return copy;
}

// 5. Build Firestore Adapter
class CollectionRef {
  collName: string;
  rawDb: any;
  constraints: any[];

  constructor(collName: string, rawDb: any, constraints: any[] = []) {
    this.collName = collName;
    this.rawDb = rawDb;
    this.constraints = constraints;
  }

  where(field: string, op: any, val: any) {
    return new CollectionRef(this.collName, this.rawDb, [...this.constraints, where(field, op, val)]);
  }

  orderBy(field: string, dir: "asc" | "desc" = "asc") {
    return new CollectionRef(this.collName, this.rawDb, [...this.constraints, orderBy(field, dir)]);
  }

  limit(n: number) {
    return new CollectionRef(this.collName, this.rawDb, [...this.constraints, limitFn(n)]);
  }

  doc(docId?: string) {
    return new DocRef(this.collName, docId, this.rawDb);
  }

  async add(data: any) {
    const collRef = collection(this.rawDb, this.collName);
    const docRef = await addDoc(collRef, sanitizeData(data));
    return new DocRef(this.collName, docRef.id, this.rawDb);
  }

  async get() {
    const collRef = collection(this.rawDb, this.collName);
    const q = this.constraints.length > 0 ? query(collRef, ...this.constraints) : collRef;
    const snap = await getDocs(q);
    return {
      empty: snap.empty,
      size: snap.size,
      docs: snap.docs.map(d => new QueryDocumentSnapshot(d, this.collName, this.rawDb))
    };
  }
}

class DocRef {
  collName: string;
  docId: string | undefined;
  rawDb: any;

  constructor(collName: string, docId: string | undefined, rawDb: any) {
    this.collName = collName;
    this.docId = docId;
    this.rawDb = rawDb;
  }

  get id() {
    return this.docId || "";
  }

  get ref() {
    return this;
  }

  async get() {
    if (!this.docId) throw new Error("Document ID required");
    const dRef = doc(this.rawDb, this.collName, this.docId);
    const snap = await getDoc(dRef);
    return {
      id: snap.id,
      exists: snap.exists(),
      data: () => snap.data(),
      ref: this
    };
  }

  async set(data: any, options?: any) {
    if (!this.docId) throw new Error("Document ID required");
    const dRef = doc(this.rawDb, this.collName, this.docId);
    await setDoc(dRef, sanitizeData(data), options);
  }

  async update(data: any) {
    if (!this.docId) throw new Error("Document ID required");
    const dRef = doc(this.rawDb, this.collName, this.docId);
    await updateDoc(dRef, sanitizeData(data));
  }

  async delete() {
    if (!this.docId) throw new Error("Document ID required");
    const dRef = doc(this.rawDb, this.collName, this.docId);
    await deleteDoc(dRef);
  }
}

class QueryDocumentSnapshot {
  _snap: any;
  collName: string;
  rawDb: any;

  constructor(snap: any, collName: string, rawDb: any) {
    this._snap = snap;
    this.collName = collName;
    this.rawDb = rawDb;
  }

  get id() {
    return this._snap.id;
  }

  get ref() {
    return new DocRef(this.collName, this._snap.id, this.rawDb);
  }

  data() {
    return this._snap.data();
  }
}

export const db: any = {
  collection(collName: string) {
    return new CollectionRef(collName, rawFirestore);
  },
  runTransaction: async (cb: any) => {
    return cb({
      get: async (ref: any) => ref.get(),
      set: async (ref: any, data: any) => ref.set(data),
      update: async (ref: any, data: any) => ref.update(data),
    });
  }
};
