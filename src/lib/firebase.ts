import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

/* Vite env vars win when present, so the repo can be deployed against another project. */
const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? 'AIzaSyA7GbPDFEPDKqOrRa-0I0_Pk7dhfWyGkXY',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? 'batman-bf259.firebaseapp.com',
  databaseURL:
    env.VITE_FIREBASE_DATABASE_URL ??
    'https://batman-bf259-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? 'batman-bf259',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? 'batman-bf259.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '786158701900',
  appId: env.VITE_FIREBASE_APP_ID ?? '1:786158701900:web:518e3698d655a3808c93e9',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();

void setPersistence(auth, browserLocalPersistence).catch(() => {
  /* Private-mode browsers block persistence; the session still works. */
});
