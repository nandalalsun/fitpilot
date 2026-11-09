// Public Firebase web config for the FitPilot project. These values identify the project; they are not secrets.
// Access to data is enforced by Firebase Authentication + Firestore security rules (firestore.rules).
export const firebaseConfig = {
  apiKey: 'AIzaSyDWcXg5xNW0Gy8feq7TApX8E2LaYA6wmaM',
  authDomain: 'fitpilot-23f1f.firebaseapp.com',
  projectId: 'fitpilot-23f1f',
  storageBucket: 'fitpilot-23f1f.firebasestorage.app',
  messagingSenderId: '632687562041',
  appId: '1:632687562041:web:ef353a525f474a79eaece8',
};

/** Cloud sync is unavailable inside the claude.ai hosted preview, whose sandbox blocks outside connections. */
export const SYNC_AVAILABLE = import.meta.env.VITE_HOSTED !== '1';
