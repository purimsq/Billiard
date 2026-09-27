import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyA-FSDw3r4-lfUiffnP16m1MPw5zDm8SSw",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "billiard-7e4f3.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "billiard-7e4f3",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "billiard-7e4f3.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "770376906739",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:770376906739:web:3aeefd5763a4927d184486",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-Z5TPPPE3PL",
};

// Initialize Firebase safely (prevent multiple instances in Next.js fast refresh)
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

let currentAuthUser: User | null = null;
let authInitPromise: Promise<User | null> | null = null;

// Ensure anonymous authentication is active
export async function ensureAnonymousAuth(): Promise<User | null> {
  if (typeof window === 'undefined') return null;

  if (auth.currentUser) {
    currentAuthUser = auth.currentUser;
    return currentAuthUser;
  }

  if (authInitPromise) {
    return authInitPromise;
  }

  authInitPromise = new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        currentAuthUser = user;
        unsubscribe();
        resolve(user);
      } else {
        try {
          const cred = await signInAnonymously(auth);
          currentAuthUser = cred.user;
          unsubscribe();
          resolve(cred.user);
        } catch (err) {
          console.warn('[Firebase] Anonymous authentication failed (will retry or operate in offline mode):', err);
          unsubscribe();
          resolve(null);
        }
      }
    });
  });

  return authInitPromise;
}

export function getCurrentUser(): User | null {
  return currentAuthUser || auth.currentUser || null;
}
