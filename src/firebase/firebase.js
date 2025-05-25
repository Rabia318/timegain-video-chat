// src/firebase/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase, ref, push } from "firebase/database";

// Firebase config - .env dosyasından değerler çekiliyor
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// Firebase uygulamasını başlat
const app = initializeApp(firebaseConfig);

// Realtime Database referansı
const db = getDatabase(app);

// ICE candidate'ı Firebase'e gönderen yardımcı fonksiyon
export const pushCandidate = (roomId, candidate) => {
  const candidatesRef = ref(db, `rooms/${roomId}/candidates`);
  push(candidatesRef, candidate);
};

export { db };
