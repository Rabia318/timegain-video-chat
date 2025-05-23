import React, { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";
import { db } from "../firebase/firebase";
import { ref, push, onChildAdded, off } from "firebase/database";

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

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(mediaStream => {
        setStream(mediaStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStream;
        }
        initPeer(mediaStream);
      })
      .catch(err => {
        console.error("Kamera/mikrofon hatası:", err);
        setError("Lütfen kamera ve mikrofona izin verin.");
      });

    return () => {
      if (peerRef.current) peerRef.current.destroy();
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (signalsRef.current) off(signalsRef.current);
    };
  }, [started]);

  function initPeer(mediaStream) {
    const initiator = userId.charCodeAt(userId.length - 1) % 2 === 0;

    const peer = new Peer({
      initiator,
      trickle: true,
      stream: mediaStream,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          {
            urls: "turn:global.relay.metered.ca:443",
            username: "openai",
            credential: "openai"
          }
        ]
      }
    });

    peerRef.current = peer;

    peer.on("signal", data => {
      push(signalsRef.current, {
        from: userId,
        signal: data
      });
    });

    onChildAdded(signalsRef.current, snapshot => {
      const msg = snapshot.val();
      if (msg.from !== userId) {
        peer.signal(msg.signal);
      }
    });

    peer.on("stream", remoteStream => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    });

    peer.on("error", err => {
      console.error("Peer error:", err);
      setError("Bağlantı hatası. Sayfayı yenileyin.");
    });
  }

  return (
    <div style={{ maxWidth: 700, margin: "30px auto", padding: 20 }}>
      <h2>Oda: {roomId}</h2>
      {!started && (
        <button onClick={() => { setStarted(true); setError(""); }}>
          Kamerayı Aç ve Bağlan
        </button>
      )}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {started && (
        <div style={{ display: "flex", justifyContent: "space-around", marginTop: 20 }}>
          <div>
            <h3>Sen</h3>
            <video ref={localVideoRef} muted autoPlay playsInline style={{ width: 300, backgroundColor: "#000" }} />
          </div>
          <div>
            <h3>Karşı Taraf</h3>
            <video ref={remoteVideoRef} autoPlay playsInline style={{ width: 300, backgroundColor: "#000" }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoChatRoom;
