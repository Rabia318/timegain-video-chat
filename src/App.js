import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, useParams, useNavigate } from "react-router-dom";
import VideoChatRoom from "./components/VideoChatRoom";
import { auth, loginAnonymously } from './firebase/firebase';
import { onAuthStateChanged } from "firebase/auth";

function RoomWrapper({ user }) {
  const { roomId } = useParams(); // URL'den roomId'yi al
  return <VideoChatRoom roomId={roomId} userId={user.uid} />;
}

function Home({ user }) {
  const [inputRoomId, setInputRoomId] = useState("");
  const navigate = useNavigate();

  // Kullanıcının girdiği oda ID'si ile odaya yönlendirme
  const handleJoin = () => {
    if (inputRoomId.trim() !== "") {
      navigate(`/room/${inputRoomId.trim()}`);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Görüntülü Odaya Katıl veya Oda Oluştur</h2>
      <input
        type="text"
        placeholder="Oda ID gir veya yeni oda için boş bırak"
        value={inputRoomId}
        onChange={(e) => setInputRoomId(e.target.value)}
        style={{ padding: "8px", fontSize: "16px", width: "250px" }}
      />
      <button
        onClick={handleJoin}
        style={{ marginLeft: "10px", padding: "8px 16px", fontSize: "16px" }}
      >
        Katıl
      </button>
      <p style={{ marginTop: "20px", fontStyle: "italic" }}>
        Yeni oda oluşturmak için boş bırakıp Enter tuşuna bas veya URL'ye yeni bir ID ile git.
      </p>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    <Router>
      <Routes>
        <Route path="/" element={<Home user={user} />} />
        <Route path="/room/:roomId" element={<RoomWrapper user={user} />} />
      </Routes>
    </Router>
  );
}

export default App;
