import { create } from 'zustand';
import { User } from 'firebase/auth';

interface AuthState {
  firebaseUser: User | null;
  user: any | null; // Backend user data
  isInitialized: boolean;
  setAuth: (firebaseUser: User | null, backendUser: any | null) => void;
  setInitialized: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  user: null,
  isInitialized: false,
  setAuth: (firebaseUser, backendUser) => set({ firebaseUser, user: backendUser }),
  setInitialized: (val) => set({ isInitialized: val }),
}));
