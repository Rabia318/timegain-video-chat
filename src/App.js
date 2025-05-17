import React, { useEffect, useState } from "react";
import VideoChatRoom from "./components/VideoChatRoom";
import { auth, loginAnonymously } from "./firebase";

function App() {
  const [user, setUser] = useState(null);
  const roomId = "my-room"; // Sabit oda ID

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(currentUser => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        loginAnonymously().catch(console.error);
      }
    });
    return () => unsubscribe();
  }, []);

  if (!user) return <div>Giriş yapılıyor...</div>;

  return (
    <div>
      <h1>Görüntülü Çalışma Odası</h1>
      <VideoChatRoom roomId={roomId} userId={user.uid} />
    </div>
  );
}

export default App;
