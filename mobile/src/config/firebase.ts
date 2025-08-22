import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';

// Firebase konfigürasyonu
const firebaseConfig = {
  apiKey: "AIzaSyCzbLV8cc3VakUSzcVruO-cXrJA1oauKmA",
  authDomain: "skillpath-6016f.firebaseapp.com",
  projectId: "skillpath-6016f",
  storageBucket: "skillpath-6016f.firebasestorage.app",
  messagingSenderId: "977573613440",
  appId: "1:977573613440:ios:a9a4de892ee9df3acdfb65"
};

// Firebase'i başlat
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
