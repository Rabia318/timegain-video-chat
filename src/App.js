import React, { useEffect, useState } from "react";
import VideoChatRoom from "./components/VideoChatRoom";
import { auth, loginAnonymously } from "./firebase/firebase";
import { onAuthStateChanged } from "firebase/auth";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const roomId = "my-room"; // Aynı odada bağlanmak için sabit oda ID

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, currentUser => {
      if (currentUser) {
        setUser(currentUser);
        setLoading(false);
      } else {
        loginAnonymously()
          .catch(err => {
            console.error("Anonim giriş hatası:", err);
            setError(err.message);
            setLoading(false);
          });
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <div>Giriş yapılıyor...</div>;
  if (error) return <div>Hata: {error}</div>;
  if (!user) return <div>Kullanıcı bulunamadı!</div>;

  return (
    <div style={{ textAlign: "center", padding: 20 }}>
      <h1>🎥 Görüntülü Çalışma Odası</h1>
      <VideoChatRoom roomId={roomId} userId={user.uid} />
    </div>
  );
}

export default App;
