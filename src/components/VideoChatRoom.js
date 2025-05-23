import React, { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";
import { db } from "../firebase/firebase";
import { ref, push, onChildAdded, remove } from "firebase/database";

const containerStyle = {
  maxWidth: 700,
  margin: "30px auto",
  padding: 20,
  borderRadius: 10,
  backgroundColor: "#f0f4f8",
  boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
  fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  textAlign: "center",
};

const videoContainerStyle = {
  display: "flex",
  justifyContent: "space-around",
  marginTop: 20,
};

const videoStyle = {
  width: 320,
  height: 240,
  borderRadius: 8,
  backgroundColor: "#000",
  boxShadow: "0 0 8px rgba(0,0,0,0.3)",
};

const buttonStyle = {
  padding: "12px 25px",
  fontSize: 16,
  borderRadius: 6,
  border: "none",
  backgroundColor: "#4a90e2",
  color: "white",
  cursor: "pointer",
  transition: "background-color 0.3s",
};

const headerStyle = {
  color: "#333",
  marginBottom: 6,
  fontWeight: "600",
};

function VideoChatRoom({ roomId, userId }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const signalsRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!started) return;

    signalsRef.current = ref(db, `rooms/${roomId}/signals`);

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((mediaStream) => {
        setStream(mediaStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStream;
        }
        createPeer(mediaStream);
      })
      .catch((err) => {
        console.error("Kamera/mikrofon erişim hatası:", err);
        setError("Lütfen kamera ve mikrofon erişim izinlerini verin.");
      });

    // Temizlik
    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (signalsRef.current) {
        remove(signalsRef.current);
      }
      setStream(null);
      setError("");
    };
  }, [started]);

  function createPeer(mediaStream) {
    // İnisiyator, örneğin userId "host" ise başlatıcı
    const isInitiator = userId === "host";

    const peer = new Peer({
      initiator: isInitiator,
      trickle: true,
      stream: mediaStream,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          {
            urls: "turn:global.relay.metered.ca:443",
            username: "openai",
            credential: "openai",
          },
        ],
      },
    });

    peerRef.current = peer;

    peer.on("signal", (data) => {
      push(signalsRef.current, {
        from: userId,
        signal: data,
      });
    });

    onChildAdded(signalsRef.current, (snapshot) => {
      const msg = snapshot.val();
      if (msg.from !== userId) {
        peer.signal(msg.signal);
      }
    });

    peer.on("stream", (remoteStream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    });

    peer.on("error", (err) => {
      console.error("Peer hatası:", err);
      setError("Bağlantı hatası oluştu, lütfen sayfayı yenileyin.");
    });
  }

  return (
    <div style={containerStyle}>
      <h2>Video Chat Odası: {roomId}</h2>
      {!started && (
        <button
          style={buttonStyle}
          onClick={() => {
            setStarted(true);
            setError("");
          }}
          onMouseEnter={(e) => (e.target.style.backgroundColor = "#357ABD")}
          onMouseLeave={(e) => (e.target.style.backgroundColor = "#4a90e2")}
        >
          Kamerayı Aç ve Bağlan
        </button>
      )}

      {error && (
        <p style={{ color: "red", marginTop: 10, fontWeight: "600" }}>{error}</p>
      )}

      {started && (
        <div style={videoContainerStyle}>
          <div>
            <h3 style={headerStyle}>Sen</h3>
            <video
              ref={localVideoRef}
              muted
              autoPlay
              playsInline
              style={videoStyle}
            />
          </div>

          <div>
            <h3 style={headerStyle}>Karşı Taraf</h3>
            <video ref={remoteVideoRef} autoPlay playsInline style={videoStyle} />
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoChatRoom;
