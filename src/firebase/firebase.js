import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyC_aWExssb1KCUB7GwVFGB-Pq6cAGRReqM",
  authDomain: "timegain-49de6.firebaseapp.com",
  databaseURL: "https://timegain-49de6-default-rtdb.firebaseio.com",
  projectId: "timegain-49de6",
  storageBucket: "timegain-49de6.appspot.com",
  messagingSenderId: "336582098261",
  appId: "1:336582098261:web:6679e3fc20f0cd1eed143dc",
};

// Firebase app initialization
const app = initializeApp(firebaseConfig);

// Auth and Database exports
export const auth = getAuth(app);
export const db = getDatabase(app);

// Anonim giriş fonksiyonu, async/await uyumlu
export const loginAnonymously = async () => {
  try {
    const userCredential = await signInAnonymously(auth);
    return userCredential;
  } catch (error) {
    console.error("Anonim giriş başarısız:", error);
    throw error;
  }
};
