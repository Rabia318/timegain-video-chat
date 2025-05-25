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
    const roomId =
      inputRoomId.trim() || Math.random().toString(36).substring(2, 10);
    navigate(`/room/${roomId}`);
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-r from-blue-300 to-blue-500 text-white">
      <h1 className="text-3xl font-bold mb-6">🎥 TimeGain Görüntülü Sohbet</h1>
      <div className="flex flex-col sm:flex-row items-center">
        <input
          type="text"
          placeholder="Oda ID gir (isteğe bağlı)"
          value={inputRoomId}
          onChange={(e) => setInputRoomId(e.target.value)}
          className="p-2 text-lg rounded mb-4 sm:mb-0 sm:mr-4 text-black"
        />
        <button
          onClick={handleJoin}
          className="px-4 py-2 text-lg bg-green-500 text-white rounded hover:bg-green-600 transition"
        >
          Katıl
        </button>
      </div>
      <p className="mt-4 italic">Oda oluşturmak için boş bırakın.</p>
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

  if (loading) return <div className="text-center mt-8">Giriş yapılıyor...</div>;
  if (error) return <div className="text-center mt-8 text-red-500">Hata: {error}</div>;
  if (!user) return <div className="text-center mt-8">Kullanıcı bulunamadı!</div>;

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
