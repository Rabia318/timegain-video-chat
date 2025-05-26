// src/App.js
import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import VideoChatRoom from "./components/VideoChatRoom";
import "./index.css";

// Ana giriş ekranı (Home)
const Home = () => {
  const [roomId, setRoomId] = useState("");
  const navigate = useNavigate();

  const handleJoinRoom = () => {
    const trimmedId = roomId.trim();
    if (trimmedId) {
      navigate(`/room/${trimmedId}`);
    }
  };

  return (
    <div className="home-page">
      <h1 className="title">WebRTC Video Chat</h1>
      <input
        className="room-input"
        type="text"
        placeholder="Oda ID'si girin"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
      />
      <button className="join-button" onClick={handleJoinRoom}>
        Odaya Katıl
      </button>
    </div>
  );
};

// Uygulama yönlendirmesi
const App = () => {
  return (
    <div className="app-container">
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:roomId" element={<VideoChatRoom />} />
        </Routes>
      </Router>
    </div>
  );
};

export default App;
