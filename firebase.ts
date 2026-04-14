// @ts-ignore - suppress misleading 'no exported member' errors for Firebase modular SDK
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyD024BD5q9F2JWO8QYtwG8CnuCWrCoNXsc",
  authDomain: "approach-673e0.firebaseapp.com",
  projectId: "approach-673e0",
  storageBucket: "approach-673e0.firebasestorage.app",
  messagingSenderId: "815257292796",
  appId: "1:815257292796:web:d2bef3f761cbb9f0e76c79",
};

// Initialize Firebase modular SDK app instance
// Use getApps() to check if an app has already been initialized to avoid errors during hot reloads
// @ts-ignore
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize and export services with the specific app instance
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;
