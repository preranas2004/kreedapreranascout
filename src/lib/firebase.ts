import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId); 
export const auth = getAuth(app);

// Simple connection test
import { doc, getDocFromCache, getDocFromServer } from 'firebase/firestore';
const testConnection = async () => {
    try {
        await getDocFromServer(doc(db, '_connection_test_', 'ping'));
        console.log("Firebase Connected Successfully");
    } catch (e) {
        console.warn("Firebase Connection Warning:", e);
    }
};
testConnection();
