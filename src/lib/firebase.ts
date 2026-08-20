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
import { 
  getFirestore, 
  initializeFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  query, 
  where, 
  serverTimestamp 
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";
import { useAuthStore } from "../store/useAuthStore";
import { applyTheme } from "./themeFont";
import { DEFAULT_AVATAR, getValidAvatar } from "./avatar";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  }, firebaseConfig.firestoreDatabaseId);
} catch (e) {
  firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}
export const db = firestoreDb;
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

export const syncAuthUser = async (firebaseUser: any, customBackendData?: any) => {
  if (!firebaseUser) {
    useAuthStore.getState().setAuth(null, null);
    useAuthStore.getState().setInitialized(true);
    return null;
  }

  if (customBackendData) {
    const payload = { id: firebaseUser.uid, ...customBackendData };
    useAuthStore.getState().setAuth(firebaseUser, payload);
    useAuthStore.getState().setInitialized(true);
    return payload;
  }

  try {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const userSnap = await getDoc(userRef);

    // Check admin existence
    let hasAdmin = true;
    try {
      const adminQuery = query(collection(db, "users"), where("role", "==", "ADMIN"));
      const adminSnap = await getDocs(adminQuery);
      hasAdmin = !adminSnap.empty;
    } catch (e) {
      console.warn("Admin check warning in syncAuthUser:", e);
    }

    if (userSnap.exists()) {
      let userData = userSnap.data();

      const isDeleted = Boolean(userData.deletedAt || userData.status === 'DELETED');
      if (isDeleted) {
        userData.isLocked = true;
        userData.status = 'DELETED';
        if (!userData.lockReason && userData.deleteReason) {
          userData.lockReason = userData.deleteReason;
        }
      }

      // Auto-unlock if lock expired (only for standard temporary suspensions, not deleted accounts)
      if (userData.isLocked && !isDeleted && userData.lockExpiresAt && new Date(userData.lockExpiresAt).getTime() < Date.now()) {
        await updateDoc(userRef, { isLocked: false, lockReason: null, lockExpiresAt: null, appealStatus: null }).catch(() => {});
        userData.isLocked = false;
        userData.lockReason = null;
        userData.lockExpiresAt = null;
        userData.appealStatus = null;
      }

      // If user is locked or deleted, query latest appeal directly from Firestore to ensure exact status
      if (userData.isLocked || isDeleted) {
        try {
          const appealQ = query(
            collection(db, 'appeals'),
            where('userId', '==', firebaseUser.uid),
            where('targetType', '==', 'ACCOUNT')
          );
          const appealSnap = await getDocs(appealQ);
          if (!appealSnap.empty) {
            const appealDocs = appealSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            appealDocs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            const latestAppeal = appealDocs[0];
            if (latestAppeal.status === 'APPROVED') {
              await updateDoc(userRef, { 
                isLocked: false, 
                status: 'ACTIVE',
                deletedAt: null,
                deletedBy: null,
                deletedByName: null,
                deleteReason: null,
                lockReason: null, 
                lockExpiresAt: null, 
                appealStatus: 'APPROVED' 
              }).catch(() => {});
              userData.isLocked = false;
              userData.status = 'ACTIVE';
              userData.deletedAt = null;
              userData.deleteReason = null;
              userData.lockReason = null;
              userData.lockExpiresAt = null;
              userData.appealStatus = 'APPROVED';
            } else {
              userData.appealStatus = latestAppeal.status || 'PENDING';
            }
          } else {
            userData.appealStatus = 'NONE';
          }
        } catch (appealErr) {
          console.warn("Check latest appeal during syncAuthUser error:", appealErr);
        }
      }

      // Auto-promote if no admin exists
      if (!hasAdmin && userData.role !== 'ADMIN') {
        await updateDoc(userRef, { role: 'ADMIN' }).catch(() => {});
        userData.role = 'ADMIN';
      }

      // Sanitize display name
      if (!userData.displayName || userData.displayName.includes('@') || userData.displayName === userData.email) {
        const safeName = sanitizeDisplayName(firebaseUser.displayName, userData.numericId || firebaseUser.uid.substring(0, 6));
        await updateDoc(userRef, { displayName: safeName }).catch(() => {});
        userData.displayName = safeName;
      }

      if (userData.themePreference) {
        applyTheme(userData.themePreference);
      }

      // Ensure avatar is valid
      userData.avatar = getValidAvatar(userData.avatar);

      const payload = { id: firebaseUser.uid, ...userData };
      useAuthStore.getState().setAuth(firebaseUser, payload);
      useAuthStore.getState().setInitialized(true);
      return payload;
    } else {
      // First time profile creation
      const { generateUniqueId } = await import('./generateId');
      const numericId = await generateUniqueId(db, 'user', firebaseUser.uid);

      const newUserData = {
        numericId,
        email: firebaseUser.email || '',
        displayName: sanitizeDisplayName(firebaseUser.displayName, numericId),
        avatar: getValidAvatar(firebaseUser.photoURL),
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

      await setDoc(userRef, newUserData);
      const payload = { id: firebaseUser.uid, ...newUserData };
      useAuthStore.getState().setAuth(firebaseUser, payload);
      useAuthStore.getState().setInitialized(true);
      return payload;
    }
  } catch (err: any) {
    if (err.message && err.message.includes("bị khóa")) {
      throw err;
    }
    console.error("syncAuthUser error fallback:", err);
    const fallbackPayload = {
      id: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: sanitizeDisplayName(firebaseUser.displayName, firebaseUser.uid.substring(0, 6)),
      avatar: getValidAvatar(firebaseUser.photoURL),
      role: "USER",
      creatorStatus: false,
      isLocked: false
    };
    useAuthStore.getState().setAuth(firebaseUser, fallbackPayload);
    useAuthStore.getState().setInitialized(true);
    return fallbackPayload;
  }
};

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const backendData = await syncAuthUser(user);
    return { user, backendData };
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
    const backendData = await syncAuthUser(user);
    return { user, backendData };
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

        // Check if locked and expired
        if (userData.isLocked && userData.lockExpiresAt && new Date(userData.lockExpiresAt).getTime() < Date.now()) {
          await updateDoc(userDoc.ref, { isLocked: false, lockReason: null, lockExpiresAt: null, appealStatus: null }).catch(() => {});
          userData.isLocked = false;
        }

        // If user is locked, query latest appeal
        if (userData.isLocked) {
          try {
            const appealQ = query(
              collection(db, 'appeals'),
              where('userId', '==', userDoc.id),
              where('targetType', '==', 'ACCOUNT')
            );
            const appealSnap = await getDocs(appealQ);
            if (!appealSnap.empty) {
              const appealDocs = appealSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
              appealDocs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              const latestAppeal = appealDocs[0];
              if (latestAppeal.status === 'APPROVED') {
                await updateDoc(userDoc.ref, { isLocked: false, lockReason: null, lockExpiresAt: null, appealStatus: 'APPROVED' }).catch(() => {});
                userData.isLocked = false;
                userData.appealStatus = 'APPROVED';
              } else {
                userData.appealStatus = latestAppeal.status || 'PENDING';
              }
            } else {
              userData.appealStatus = 'NONE';
            }
          } catch (appealErr) {
            console.warn("Check appeal during fallback login error:", appealErr);
          }
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
          photoURL: getValidAvatar(userData.avatar)
        };

        const sessionPayload = { id: userDoc.id, ...userData };
        localStorage.setItem('custom_auth_user', JSON.stringify(sessionPayload));
        useAuthStore.getState().setAuth(simulatedUser, sessionPayload);
        useAuthStore.getState().setInitialized(true);

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
    const backendData = await syncAuthUser(user);
    return { user, backendData };
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
          avatar: DEFAULT_AVATAR,
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
        useAuthStore.getState().setAuth(simulatedUser, sessionPayload);
        useAuthStore.getState().setInitialized(true);

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
  useAuthStore.getState().setAuth(null, null);
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


