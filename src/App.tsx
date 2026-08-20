/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, syncAuthUser } from './lib/firebase';
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useAuthStore } from './store/useAuthStore';
import toast, { Toaster } from 'react-hot-toast';

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
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import AdminDashboard from './pages/AdminDashboard';
import DashboardStats from './pages/admin/DashboardStats';
import UserManagement from './pages/admin/UserManagement';
import ReportQueue from './pages/admin/ReportQueue';
import AuditLogs from './pages/admin/AuditLogs';
import BadgeManager from './pages/admin/BadgeManager';
import SupportManager from './pages/admin/SupportManager';
import AdminModeratorManager from './pages/admin/AdminModeratorManager';
import CreatorManager from './pages/admin/CreatorManager';
import AppealManagement from './pages/admin/AppealManagement';
import CreatorDetail from './pages/CreatorDetail';
import CharacterDetail from './pages/CharacterDetail';
import PromptDetail from './pages/PromptDetail';
import { initThemeAndFont, applyTheme } from './lib/themeFont';
import ProtectedRoute from './components/auth/ProtectedRoute';
import SuspendedAccountModal from './components/modals/SuspendedAccountModal';

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

function UserRealtimeSync() {
  const { user, firebaseUser, setAuth } = useAuthStore();

  useEffect(() => {
    if (!user?.id) return;

    const userRef = doc(db, 'users', user.id);
    const unsubscribe = onSnapshot(userRef, async (docSnap) => {
      if (!docSnap.exists()) return;

      const userData = docSnap.data() as any;

      // Check lock status
      if (userData.isLocked) {
        const lockExpired = userData.lockExpiresAt && new Date(userData.lockExpiresAt).getTime() < Date.now();
        if (lockExpired) {
          // Auto unlock if expired
          await updateDoc(userRef, { isLocked: false, lockReason: null, lockExpiresAt: null, appealStatus: null }).catch(() => {});
        }
      }

      // Sync user data to Zustand store
      const currentAuthUser = useAuthStore.getState().user;
      if (currentAuthUser) {
        setAuth(firebaseUser, {
          ...currentAuthUser,
          ...userData,
          id: user.id
        });
      }
    }, (err) => {
      console.error("Realtime user sync error:", err);
    });

    return () => unsubscribe();
  }, [user?.id]);

  return null;
}

export default function App() {
  const { setAuth, setInitialized } = useAuthStore();

  useEffect(() => {
    initThemeAndFont();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          await syncAuthUser(firebaseUser);
        } catch (e) {
          console.error("Failed to sync user profile in auth listener:", e);
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
      <UserRealtimeSync />
      <SuspendedAccountModal />
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
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/creator/dashboard" element={<ProtectedRoute><CreatorDashboard /></ProtectedRoute>} />
          <Route path="/creator/:id" element={<CreatorDetail />} />
          <Route path="/user/:id" element={<CreatorDetail />} />
          <Route path="/character/:id" element={<CharacterDetail />} />
          <Route path="/prompt/:id" element={<PromptDetail />} />
          <Route path="/admin" element={<ProtectedRoute><DashboardStats /></ProtectedRoute>} />
          <Route path="/admin/dashboard" element={<ProtectedRoute><DashboardStats /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
          <Route path="/admin/reports" element={<ProtectedRoute><ReportQueue /></ProtectedRoute>} />
          <Route path="/admin/appeals" element={<ProtectedRoute><AppealManagement /></ProtectedRoute>} />
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

