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
    <div className="home-container">
      <h1>🎥 TimeGain Görüntülü Sohbet</h1>
      <div className="input-group">
        <input
          type="text"
          placeholder="Oda ID gir (isteğe bağlı)"
          value={inputRoomId}
          onChange={(e) => setInputRoomId(e.target.value)}
          className="input-text"
        />
        <button onClick={handleJoin} className="btn-primary">
          Katıl
        </button>
      </div>
      <p className="info-text">Oda oluşturmak için boş bırakın.</p>
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

  if (loading) return <div className="loading-text">Giriş yapılıyor...</div>;
  if (error) return <div className="error-text">Hata: {error}</div>;
  if (!user) return <div className="error-text">Kullanıcı bulunamadı!</div>;

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
