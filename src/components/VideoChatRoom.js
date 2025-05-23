import React, { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";
import { db } from "../firebase/firebase";
import { ref, push, onChildAdded, off, get } from "firebase/database";

function VideoChatRoom({ roomId, userId }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const signalsRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState("");

  // Peer state
  const hasReceivedOffer = useRef(false);
  const queuedSignals = useRef([]);

  useEffect(() => {
    if (!started) return;

    signalsRef.current = ref(db, `rooms/${roomId}/signals`);

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(async (mediaStream) => {
        setStream(mediaStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStream;
        }

        const snapshot = await get(signalsRef.current);
        const isInitiator = !snapshot.exists();

        initPeer(mediaStream, isInitiator);
      })
      .catch((err) => {
        console.error("Kamera/mikrofon hatası:", err);
        setError("Kamera ve mikrofona erişim izni gerekli.");
      });

    return () => {
      if (peerRef.current) peerRef.current.destroy();
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (signalsRef.current) off(signalsRef.current);
      queuedSignals.current = [];
    };
  }, [started]);

  function initPeer(mediaStream, isInitiator) {
    const peer = new Peer({
      initiator: isInitiator,
      trickle: false,
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

    peer.on("signal", (data) => {
      push(signalsRef.current, {
        from: userId,
        signal: data,
      });
    });

    onChildAdded(signalsRef.current, (snapshot) => {
      const msg = snapshot.val();
      if (msg.from === userId || !msg.signal) return;

      const signal = msg.signal;
      const type = signal.type;

      if (!peer.initiator && type === "offer") {
        hasReceivedOffer.current = true;
        peer.signal(signal);
        processQueuedSignals(); // offer geldikten sonra diğerlerini uygula
      } else if (!peer.initiator && type === "answer") {
        if (!hasReceivedOffer.current) {
          queuedSignals.current.push(signal); // offer yoksa answer'ı beklet
        } else {
          peer.signal(signal);
        }
      } else {
        // type yoksa (candidate gibi) doğrudan uygula
        try {
          peer.signal(signal);
        } catch (err) {
          console.warn("ICE signal apply failed, queued:", signal);
          queuedSignals.current.push(signal);
        }
      }
    });

    peer.on("stream", (remoteStream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    });

    peer.on("error", (err) => {
      console.error("Peer error:", err);
      setError("Bağlantı hatası. Sayfayı yenileyin.");
    });
  }

  function processQueuedSignals() {
    queuedSignals.current.forEach(sig => {
      try {
        peerRef.current.signal(sig);
      } catch (err) {
        console.warn("Queued signal işleminde hata:", err);
      }
    });
    queuedSignals.current = [];
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
            <video
              ref={localVideoRef}
              muted
              autoPlay
              playsInline
              style={{ width: 300, backgroundColor: "#000" }}
            />
          </div>
          <div>
            <h3>Karşı Taraf</h3>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{ width: 300, backgroundColor: "#000" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoChatRoom;
