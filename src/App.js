// src/App.js
import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useParams,
  useNavigate,
} from "react-router-dom";
import VideoChatRoom from "./components/VideoChatRoom";
import { auth, loginAnonymously } from "./firebase/firebase";
import { onAuthStateChanged } from "firebase/auth";

function RoomWrapper({ user }) {
  const { roomId } = useParams();
  return <VideoChatRoom roomId={roomId} userId={user.uid} />;
}

function Home() {
  const [inputRoomId, setInputRoomId] = useState("");
  const navigate = useNavigate();

  const handleJoin = () => {
    const roomId = inputRoomId.trim() || Math.random().toString(36).substring(2, 10);
    navigate(`/room/${roomId}`);
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      background: "linear-gradient(to right, #667eea, #764ba2)",
      color: "#fff"
    }}>
      <h1>🎥 TimeGain Görüntülü Sohbet</h1>
      <div style={{ marginTop: 20 }}>
        <input
          type="text"
          placeholder="Oda ID gir (isteğe bağlı)"
          value={inputRoomId}
          onChange={(e) => setInputRoomId(e.target.value)}
          style={{
            padding: "10px",
            fontSize: "16px",
            borderRadius: "8px",
            width: "250px"
          }}
        />
        <button
          onClick={handleJoin}
          style={{
            marginLeft: "10px",
            padding: "10px 20px",
            fontSize: "16px",
            backgroundColor: "#4caf50",
            color: "white",
            cursor: "pointer",
            borderRadius: "8px"
          }}
        >
          Katıl
        </button>
      </div>
      <p style={{ marginTop: "20px", fontStyle: "italic" }}>
        Oda oluşturmak için boş bırakın.
      </p>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setLoading(false);
      } else {
        loginAnonymously().catch((err) => {
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
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:roomId" element={<RoomWrapper user={user} />} />
      </Routes>
    </Router>
  );
}

export default App;
