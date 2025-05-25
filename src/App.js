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
import "./index.css";

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
    <div className="home-container">
      <h1 className="home-title">🎥 TimeGain Görüntülü Sohbet</h1>
      <div className="home-form">
        <input
          type="text"
          placeholder="Oda ID gir (isteğe bağlı)"
          value={inputRoomId}
          onChange={(e) => setInputRoomId(e.target.value)}
          className="input"
        />
        <button className="btn-success" onClick={handleJoin}>
          Katıl
        </button>
      </div>
      <p className="hint-text">Oda oluşturmak için boş bırakın.</p>
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

  if (loading) return <div className="loading">Giriş yapılıyor...</div>;
  if (error) return <div className="error-text">Hata: {error}</div>;
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
