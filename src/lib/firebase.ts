import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import config from '../../firebase-applet-config.json';

// Use environment variables if specified (for Vercel deployment), otherwise fallback to local JSON config file
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || config.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || config.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || config.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || config.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || config.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || config.appId
};

const app = initializeApp(firebaseConfig);

const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || config.firestoreDatabaseId || '(default)';

// Since the Firestore is provisioned in a non-default database ID, we specify it here.
export const db = initializeFirestore(app, {}, databaseId);

export const auth = getAuth(app);


