// src/App.js
import React, { useState } from "react";
import { BrowserRouter as Router, Route, Routes, useNavigate } from "react-router-dom";
import VideoChatRoom from "./components/VideoChatRoom";
import "./index.css";

const Home = () => {
  const [roomId, setRoomId] = useState("");
  const navigate = useNavigate();

  const handleJoin = () => {
    const trimmedRoomId = roomId.trim();
    if (trimmedRoomId) {
      navigate(`/room/${trimmedRoomId}`);
    }
  };

  return (
    <div
      className="home-page"
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#f7f8fa",
      }}
    >
      <h1
        className="title"
        style={{ color: "#3a4e8c", marginBottom: "1rem", fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif" }}
      >
        WebRTC Video Chat
      </h1>
      <input
        type="text"
        placeholder="Enter Room ID"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        style={{
          padding: "10px",
          width: "300px",
          borderRadius: "8px",
          border: "1px solid #a8c0ff",
          fontSize: "1rem",
          marginBottom: "1rem",
          outline: "none",
        }}
        onKeyDown={(e) => e.key === "Enter" && handleJoin()}
      />
      <button
        onClick={handleJoin}
        style={{
          padding: "10px 25px",
          borderRadius: "8px",
          border: "none",
          backgroundColor: "#3a
