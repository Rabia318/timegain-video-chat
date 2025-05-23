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

  // Sinyal kuyruğu
  const signalQueue = useRef([]);

  useEffect(() => {
    if (!started) return;

    // Firebase sinyal yolu
    signalsRef.current = ref(db, `rooms/${roomId}/signals`);

    // Kamerayı aç
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(async (mediaStream) => {
        setStream(mediaStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStream;
        }

        // İlk kullanıcıyı belirle: eğer sinyal yoksa initiator'dur
        const snapshot = await get(signalsRef.current);
        const isInitiator = !snapshot.exists();

        initPeer(mediaStream, isInitiator);
      })
      .catch((err) => {
        console.error("Kamera/mikrofon hatası:", err);
        setError("Lütfen kamera ve mikrofona izin verin.");
      });

    return () => {
      if (peerRef.current) peerRef.current.destroy();
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (signalsRef.current) off(signalsRef.current);
      signalQueue.current = [];
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

    // Signal oluşturulunca Firebase'e yaz
    peer.on("signal", (data) => {
      push(signalsRef.current, {
        from: userId,
        signal: data,
      });
    });

    // Firebase'deki diğer kullanıcıdan gelen sinyalleri dinle ve kuyruğa al
    onChildAdded(signalsRef.current, (snapshot) => {
      const msg = snapshot.val();
      if (msg.from !== userId) {
        signalQueue.current.push(msg.signal);
        processSignalQueue();
      }
    });

    // Kuyruktaki sinyalleri sırayla işle
    function processSignalQueue() {
      if (!peerRef.current || signalQueue.current.length === 0) return;

      try {
        const signal = signalQueue.current.shift();
        peerRef.current.signal(signal);

        if (signalQueue.current.length > 0) {
          setTimeout(processSignalQueue, 100);
        }
      } catch (err) {
        console.warn("Signal işlenirken hata:", err);
        // İstersen hata durumunda sinyali tekrar kuyruğa atabilirsin
        // signalQueue.current.unshift(signal);
      }
    }

    // Karşı tarafın stream'i geldiğinde göster
    peer.on("stream", (remoteStream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    });

    peer.on("error", (err) => {
      console.error("Peer error:", err);
      setError("Bağlantı hatası oluştu. Sayfayı yenileyin.");
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
