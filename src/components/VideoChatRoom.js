import React, { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";
import { db } from "../firebase/firebase";
import { ref, push, onChildAdded, off } from "firebase/database";

// Basit benzersiz kullanıcı ID'si oluşturucu
function generateUserId() {
  return "user_" + Math.random().toString(36).substring(2, 9);
}

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

function VideoChatRoom({ roomId }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const signalsRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState("");
  const [userId] = useState(generateUserId()); // Her kullanıcı için benzersiz ID oluştur

  useEffect(() => {
    if (!started) return;

    signalsRef.current = ref(db, `rooms/${roomId}/signals`);

    // Kamerayı aç
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((mediaStream) => {
        setStream(mediaStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStream;
        }
        initPeer(mediaStream);
      })
      .catch((err) => {
        console.error("Kamera/mikrofon erişim hatası:", err);
        setError("Lütfen kamera ve mikrofon erişim izinlerini verin.");
      });

    // Cleanup - component unmount ya da started false olursa
    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
      if (signalsRef.current) {
        off(signalsRef.current); // Firebase dinlemeyi kapat
      }
      setError("");
    };
  }, [started]);

  function initPeer(mediaStream) {
    const peer = new Peer({
      initiator: userId.endsWith("0") ? true : false, // Örnek basit başlatıcı belirleme (örneğin userId son karakterine göre)
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

    // Sinyal oluşturulunca Firebase'e gönder
    peer.on("signal", (data) => {
      push(signalsRef.current, {
        from: userId,
        signal: data,
      });
    });

    // Firebase'den sinyal dinle
    onChildAdded(signalsRef.current, (snapshot) => {
      const msg = snapshot.val();
      if (msg.from !== userId) {
        peer.signal(msg.signal);
      }
    });

    // Karşı tarafın streami geldiğinde video'ya ata
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
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={videoStyle}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoChatRoom;
