import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import config from '../../firebase-applet-config.json';

const app = initializeApp({
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId
});

// Since the Firestore is provisioned in a non-default database ID, we specify it here.
export const db = initializeFirestore(app, {}, config.firestoreDatabaseId || '(default)');

export const auth = getAuth(app);

