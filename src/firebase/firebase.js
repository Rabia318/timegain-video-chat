import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getDatabase } from "firebase/database";

// 🔧 Firebase config bilgilerini buraya kendi panelinden kopyala
const firebaseConfig = {
  apiKey: "AIzaSyC_aWExssb1KCUB7GwVFGB-Pq6cAGRReqM",
  authDomain: "timegain-49de6.firebaseapp.com",
  projectId: "timegain-49de6",
  storageBucket: "timegain-49de6.appspot.com",
  messagingSenderId: "336582098261",
  appId: "1:336582098261:web:6679e3fc20f0cd1eed143dc",
  databaseURL: "https://timegain-49de6-default-rtdb.firebaseio.com" // 🔥 Bu satır Realtime DB için zorunlu
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app); // ✅ Realtime DB
export const loginAnonymously = () => signInAnonymously(auth);

