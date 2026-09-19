import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Test Firestore Connection as per Firebase skill mandates
async function testConnection() {
  try {
    const snap = await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firebase connection check: Succeeded. Document exists =', snap.exists());
  } catch (error) {
    console.error('Firebase connection check: Failed with error:', error);
  }
}

testConnection();
