import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import VideoChatRoom from "./components/VideoChatRoom";
import "./index.css";

const App = () => {
  return (
    <div className="app-container">
      <Router>
        <Routes>
          <Route path="/room/:roomId" element={<VideoChatRoom />} />
          <Route
            path="/"
            element={
              <div className="home-page">
                <h1 className="title">WebRTC Video Chat</h1>
                <input
                  type="text"
                  placeholder="Enter Room ID"
                  id="roomInput"
                  className="room-input"
                />
                <button
                  className="join-button"
                  onClick={() => {
                    const roomId = document.getElementById("roomInput").value.trim();
                    if (roomId) window.location.href = `/room/${roomId}`;
                  }}
                >
                  Join Room
                </button>
              </div>
            }
          />
        </Routes>
      </Router>
    </div>
  );
};

export default App;
