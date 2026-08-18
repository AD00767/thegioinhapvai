import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail
} from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, serverTimestamp } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export const sanitizeDisplayName = (rawName: string | null | undefined, numericId: string): string => {
  if (!rawName) return `Thành viên #${numericId}`;
  const trimmed = rawName.trim();
  // Never expose email or email username in public displayName
  if (trimmed.includes('@') || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return `Thành viên #${numericId}`;
  }
  return trimmed;
};

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Check if any admin exists in the system
    const adminQuery = query(collection(db, "users"), where("role", "==", "ADMIN"));
    const adminSnap = await getDocs(adminQuery);
    const hasAdmin = !adminSnap.empty;

    // Sync with Firestore directly
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    
    let backendData;
    if (!userSnap.exists()) {
      const { generateUniqueId } = await import('./generateId');
      const numericId = await generateUniqueId(db, 'user', user.uid);

      backendData = {
        numericId,
        email: user.email,
        displayName: sanitizeDisplayName(user.displayName, numericId),
        avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
        bio: "",
        socialLinks: {},
        role: hasAdmin ? "USER" : "ADMIN", // Grant ADMIN to the first participant if no admin exists
        creatorStatus: false,
        isLocked: false,
        strikeCount: 0,
        badges: [],
        permissions: hasAdmin ? [] : ["ALL"],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedAt: null
      };
      await setDoc(userRef, backendData);
    } else {
      backendData = userSnap.data();
      if (backendData.isLocked) {
        await signOut(auth);
        throw new Error("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.");
      }
      // If displayName was set to an email or contains @, sanitize it immediately
      if (!backendData.displayName || backendData.displayName.includes('@') || backendData.displayName === backendData.email) {
        backendData.displayName = sanitizeDisplayName(null, backendData.numericId || user.uid.substring(0, 6));
        await updateDoc(userRef, { displayName: backendData.displayName }).catch(() => {});
      }
      // If no admin exists in system, auto-upgrade this user to ADMIN
      if (!hasAdmin && backendData.role !== "ADMIN") {
        backendData.role = "ADMIN";
        await updateDoc(userRef, { role: "ADMIN" });
      }
    }
    
    return { user, backendData: { id: user.uid, ...backendData } };
  } catch (error: any) {
    console.error("Google Login error:", error);
    throw error;
  }
};

export const hashPassword = async (password: string): Promise<string> => {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + "_tg_nhapvai_ad_salt_2026");
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    // Fallback simple hash if subtle crypto is unavailable in some edge context
    let hash = 0;
    const str = password + "_tg_salt";
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return 'fallback_' + Math.abs(hash).toString(16);
  }
};

export const loginWithEmail = async (email: string, password: string) => {
  const cleanEmail = email.trim().toLowerCase();

  try {
    const result = await signInWithEmailAndPassword(auth, cleanEmail, password);
    const user = result.user;

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const backendData = userSnap.data();
      if (backendData.isLocked) {
        await signOut(auth);
        throw new Error("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.");
      }
      return { user, backendData: { id: user.uid, ...backendData } };
    }
    return { user, backendData: null };
  } catch (error: any) {
    console.warn("Primary Firebase Auth login attempt result:", error?.code || error?.message);
    const code = error.code || "";

    // If Firebase Auth does not have Email/Password enabled, seamlessly use database account engine
    if (code === "auth/operation-not-allowed") {
      try {
        const userQuery = query(collection(db, "users"), where("email", "==", cleanEmail));
        const userSnap = await getDocs(userQuery);

        if (userSnap.empty) {
          throw new Error("Tài khoản email này chưa được đăng ký.");
        }

        const userDoc = userSnap.docs[0];
        const userData = userDoc.data();

        if (userData.isLocked) {
          throw new Error("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.");
        }

        // Verify password hash
        const hashedInput = await hashPassword(password);
        if (userData.passwordHash && userData.passwordHash !== hashedInput) {
          throw new Error("Mật khẩu hoặc email không chính xác.");
        }

        const simulatedUser: any = {
          uid: userDoc.id,
          email: cleanEmail,
          displayName: userData.displayName || cleanEmail.split('@')[0],
          photoURL: userData.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userDoc.id}`
        };

        const sessionPayload = { id: userDoc.id, ...userData };
        localStorage.setItem('custom_auth_user', JSON.stringify(sessionPayload));

        return { user: simulatedUser, backendData: sessionPayload };
      } catch (fallbackErr: any) {
        throw fallbackErr;
      }
    }

    // Map Firebase auth errors to friendly Vietnamese messages
    let friendlyMessage = "Đăng nhập thất bại. Vui lòng kiểm tra thông tin và thử lại.";

    if (code === "auth/invalid-email") {
      friendlyMessage = "Địa chỉ email không đúng định dạng.";
    } else if (code === "auth/user-not-found") {
      friendlyMessage = "Tài khoản email này chưa được đăng ký.";
    } else if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
      friendlyMessage = "Mật khẩu hoặc email không chính xác.";
    } else if (code === "auth/too-many-requests") {
      friendlyMessage = "Bạn đã thử đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ít phút.";
    } else if (code === "auth/user-disabled") {
      friendlyMessage = "Tài khoản của bạn đã bị vô hiệu hóa.";
    } else if (code === "auth/network-request-failed") {
      friendlyMessage = "Lỗi kết nối mạng. Vui lòng kiểm tra lại đường truyền internet.";
    } else if (error.message) {
      friendlyMessage = error.message;
    }

    throw new Error(friendlyMessage);
  }
};

export const registerWithEmail = async (email: string, password: string) => {
  const cleanEmail = email.trim().toLowerCase();

  try {
    const result = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    const user = result.user;

    // Check if any admin exists in the system
    let hasAdmin = true;
    try {
      const adminQuery = query(collection(db, "users"), where("role", "==", "ADMIN"));
      const adminSnap = await getDocs(adminQuery);
      hasAdmin = !adminSnap.empty;
    } catch (adminCheckErr) {
      console.warn("Could not check admin status, defaulting to USER role:", adminCheckErr);
    }

    const { generateUniqueId } = await import('./generateId');
    const numericId = await generateUniqueId(db, 'user', user.uid);

    const userRef = doc(db, "users", user.uid);
    const backendData = {
      numericId,
      email: user.email,
      displayName: sanitizeDisplayName(user.displayName, numericId),
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
      bio: "",
      socialLinks: {},
      role: hasAdmin ? "USER" : "ADMIN",
      creatorStatus: false,
      isLocked: false,
      strikeCount: 0,
      badges: [],
      permissions: hasAdmin ? [] : ["ALL"],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      deletedAt: null
    };

    try {
      await setDoc(userRef, backendData);
    } catch (setDocErr) {
      console.warn("Could not immediately create user document in registerWithEmail, auth listener will sync it:", setDocErr);
    }

    return { user, backendData: { id: user.uid, ...backendData } };
  } catch (error: any) {
    console.warn("Primary Firebase Auth register attempt result:", error?.code || error?.message);
    const code = error.code || "";

    // If Firebase Auth does not have Email/Password provider enabled, seamlessly register in database
    if (code === "auth/operation-not-allowed") {
      try {
        // Check if email is already used in Firestore users collection
        const userEmailQuery = query(collection(db, "users"), where("email", "==", cleanEmail));
        const userEmailSnap = await getDocs(userEmailQuery);
        if (!userEmailSnap.empty) {
          throw new Error("Email này đã được sử dụng. Vui lòng chuyển sang tab 'Đăng nhập' hoặc sử dụng tài khoản Google.");
        }

        // Check if any admin exists
        let hasAdmin = true;
        try {
          const adminQuery = query(collection(db, "users"), where("role", "==", "ADMIN"));
          const adminSnap = await getDocs(adminQuery);
          hasAdmin = !adminSnap.empty;
        } catch (adminCheckErr) {
          console.warn("Admin check failed:", adminCheckErr);
        }

        const customUid = "usr_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 7);
        const { generateUniqueId } = await import('./generateId');
        const numericId = await generateUniqueId(db, 'user', customUid);
        const passwordHash = await hashPassword(password);

        const userRef = doc(db, "users", customUid);
        const backendData: any = {
          numericId,
          email: cleanEmail,
          passwordHash,
          displayName: sanitizeDisplayName(null, numericId),
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${customUid}`,
          bio: "",
          socialLinks: {},
          role: hasAdmin ? "USER" : "ADMIN",
          creatorStatus: false,
          isLocked: false,
          strikeCount: 0,
          badges: [],
          permissions: hasAdmin ? [] : ["ALL"],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          deletedAt: null
        };

        await setDoc(userRef, backendData);

        const simulatedUser: any = {
          uid: customUid,
          email: cleanEmail,
          displayName: backendData.displayName,
          photoURL: backendData.avatar
        };

        const sessionPayload = { id: customUid, ...backendData };
        localStorage.setItem('custom_auth_user', JSON.stringify(sessionPayload));

        return { user: simulatedUser, backendData: sessionPayload };
      } catch (fallbackErr: any) {
        throw fallbackErr;
      }
    }

    let friendlyMessage = "Đăng ký thất bại. Vui lòng thử lại.";

    if (code === "auth/email-already-in-use") {
      friendlyMessage = "Email này đã được sử dụng. Vui lòng chuyển sang tab 'Đăng nhập' hoặc sử dụng tài khoản Google.";
    } else if (code === "auth/invalid-email") {
      friendlyMessage = "Địa chỉ email không đúng định dạng.";
    } else if (code === "auth/weak-password") {
      friendlyMessage = "Mật khẩu phải có ít nhất 6 ký tự.";
    } else if (code === "auth/network-request-failed") {
      friendlyMessage = "Lỗi kết nối mạng. Vui lòng kiểm tra lại đường truyền internet.";
    } else if (error.message) {
      friendlyMessage = error.message;
    }

    throw new Error(friendlyMessage);
  }
};

export const logout = async () => {
  localStorage.removeItem('custom_auth_user');
  try {
    await signOut(auth);
  } catch (e) {
    console.warn("SignOut error:", e);
  }
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}


