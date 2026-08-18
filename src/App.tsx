/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, sanitizeDisplayName } from './lib/firebase';
import { doc, getDoc, updateDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { useAuthStore } from './store/useAuthStore';
import { Toaster } from 'react-hot-toast';

import Layout from './components/layout/Layout';
import Welcome from './pages/Welcome';
import Home from './pages/Home';
import Profile from './pages/Profile';
import AISearch from './pages/AISearch';
import CreatorDashboard from './pages/CreatorDashboard';
import Prompts from './pages/Prompts';
import Feedbacks from './pages/Feedbacks';
import Explore from './pages/Explore';
import Characters from './pages/Characters';
import Creators from './pages/Creators';
import Notifications from './pages/Notifications';
import Contact from './pages/Contact';
import Settings from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';
import DashboardStats from './pages/admin/DashboardStats';
import UserManagement from './pages/admin/UserManagement';
import ReportQueue from './pages/admin/ReportQueue';
import AuditLogs from './pages/admin/AuditLogs';
import BadgeManager from './pages/admin/BadgeManager';
import SupportManager from './pages/admin/SupportManager';
import AdminModeratorManager from './pages/admin/AdminModeratorManager';
import CreatorManager from './pages/admin/CreatorManager';
import CreatorDetail from './pages/CreatorDetail';
import CharacterDetail from './pages/CharacterDetail';
import PromptDetail from './pages/PromptDetail';
import { initThemeAndFont, applyTheme } from './lib/themeFont';
import ProtectedRoute from './components/auth/ProtectedRoute';

function RootGate() {
  const { user, isInitialized } = useAuthStore();
  const [hasEntered, setHasEntered] = useState<boolean>(() => {
    return sessionStorage.getItem('has_entered_app') === 'true';
  });

  useEffect(() => {
    const handleEnteredChange = () => {
      setHasEntered(sessionStorage.getItem('has_entered_app') === 'true');
    };
    window.addEventListener('app-entered-changed', handleEnteredChange);
    return () => window.removeEventListener('app-entered-changed', handleEnteredChange);
  }, []);

  if (!isInitialized) return null;

  // If user is authenticated or has entered as a guest, show Home inside Layout
  if (user || hasEntered) {
    return (
      <Layout>
        <Home />
      </Layout>
    );
  }

  // Otherwise, show full screen Welcome Page on first visit
  return <Welcome onStart={() => setHasEntered(true)} />;
}

export default function App() {
  const { setAuth, setInitialized } = useAuthStore();

  useEffect(() => {
    initThemeAndFont();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          let userSnap;
          try {
            userSnap = await getDoc(userRef);
          } catch (fetchErr) {
            console.warn("User profile fetch delayed or pending permission:", fetchErr);
          }

          // Check if any admin exists in the system (fail-safe)
          let hasAdmin = true;
          try {
            const adminQuery = query(collection(db, "users"), where("role", "==", "ADMIN"));
            const adminSnap = await getDocs(adminQuery);
            hasAdmin = !adminSnap.empty;
          } catch (adminErr) {
            hasAdmin = true; // default to safe USER role if query is unavailable
          }

          if (userSnap && userSnap.exists()) {
            let userData = userSnap.data();
            // If no admin exists in the system, auto-upgrade the current user to ADMIN
            if (!hasAdmin && userData.role !== 'ADMIN') {
              try {
                await updateDoc(userRef, { role: 'ADMIN' });
                userData.role = 'ADMIN';
              } catch (upErr) {
                console.warn("Could not update admin role:", upErr);
              }
            }
            // If displayName looks like an email or was set to email, sanitize it
            if (!userData.displayName || userData.displayName.includes('@') || userData.displayName === userData.email) {
              const safeName = sanitizeDisplayName(null, userData.numericId || firebaseUser.uid.substring(0, 6));
              try {
                await updateDoc(userRef, { displayName: safeName });
                userData.displayName = safeName;
              } catch (upNameErr) {
                userData.displayName = safeName;
              }
            }
            if (userData.themePreference) {
              applyTheme(userData.themePreference);
            }
            setAuth(firebaseUser, { id: firebaseUser.uid, ...userData } as any);
          } else {
            // First time profile creation in auth listener
            let numericId = firebaseUser.uid.substring(0, 9);
            try {
              const { generateUniqueId } = await import('./lib/generateId');
              numericId = await generateUniqueId(db, 'user', firebaseUser.uid);
            } catch (idGenErr) {
              console.warn("Falling back to standard ID generation:", idGenErr);
            }
            
            const newUserData = {
              numericId,
              email: firebaseUser.email,
              displayName: sanitizeDisplayName(firebaseUser.displayName, numericId),
              avatar: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`,
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
              const { setDoc } = await import('firebase/firestore');
              await setDoc(userRef, newUserData);
            } catch (setDocErr) {
              console.warn("User document creation pending sync:", setDocErr);
            }
            setAuth(firebaseUser, { id: firebaseUser.uid, ...newUserData } as any);
          }
        } catch (e) {
          console.warn("Gracefully fallback user profile:", e);
          const fallbackName = sanitizeDisplayName(firebaseUser.displayName, firebaseUser.uid.substring(0, 6));
          setAuth(firebaseUser, {
            id: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: fallbackName,
            avatar: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`,
            role: "USER",
            creatorStatus: false,
            isLocked: false
          } as any);
        }
      } else {
        // Check if custom auth session exists (for database-backed email/password users)
        const customSession = localStorage.getItem('custom_auth_user');
        if (customSession) {
          try {
            const parsed = JSON.parse(customSession);
            if (parsed && parsed.id) {
              const userRef = doc(db, 'users', parsed.id);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                const userData = userSnap.data();
                if (!userData.isLocked) {
                  const simulatedUser: any = {
                    uid: parsed.id,
                    email: userData.email,
                    displayName: userData.displayName,
                    photoURL: userData.avatar
                  };
                  if (userData.themePreference) {
                    applyTheme(userData.themePreference);
                  }
                  setAuth(simulatedUser, { id: parsed.id, ...userData });
                } else {
                  localStorage.removeItem('custom_auth_user');
                  setAuth(null, null);
                }
              } else {
                setAuth({
                  uid: parsed.id,
                  email: parsed.email,
                  displayName: parsed.displayName,
                  photoURL: parsed.avatar
                } as any, parsed);
              }
            } else {
              setAuth(null, null);
            }
          } catch (err) {
            console.error("Failed to restore custom auth session:", err);
            setAuth(null, null);
          }
        } else {
          setAuth(null, null);
        }
      }
      setInitialized(true);
    });

    return () => unsubscribe();
  }, []);

  return (
    <BrowserRouter>
      <Toaster position="top-center" />
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/" element={<RootGate />} />
        
        <Route element={<Layout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/characters" element={<Characters />} />
          <Route path="/creators" element={<Creators />} />
          <Route path="/ai-search" element={<AISearch />} />
          <Route path="/prompts" element={<Prompts />} />
          <Route path="/feedbacks" element={<Feedbacks />} />
          <Route path="/feedback" element={<Feedbacks />} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/creator/dashboard" element={<ProtectedRoute><CreatorDashboard /></ProtectedRoute>} />
          <Route path="/creator/:id" element={<CreatorDetail />} />
          <Route path="/character/:id" element={<CharacterDetail />} />
          <Route path="/prompt/:id" element={<PromptDetail />} />
          <Route path="/admin" element={<ProtectedRoute><DashboardStats /></ProtectedRoute>} />
          <Route path="/admin/dashboard" element={<ProtectedRoute><DashboardStats /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
          <Route path="/admin/reports" element={<ProtectedRoute><ReportQueue /></ProtectedRoute>} />
          <Route path="/admin/audit" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
          <Route path="/admin/badges" element={<ProtectedRoute><BadgeManager /></ProtectedRoute>} />
          <Route path="/admin/support" element={<ProtectedRoute><SupportManager /></ProtectedRoute>} />
          <Route path="/admin/managers" element={<ProtectedRoute><AdminModeratorManager /></ProtectedRoute>} />
          <Route path="/admin/creators" element={<ProtectedRoute><CreatorManager /></ProtectedRoute>} />
          <Route path="/admin/content" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          {/* Add more routes later */}
          <Route path="*" element={<div className="p-8 text-center">404 - Not Found</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

