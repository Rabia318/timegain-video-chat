import React, { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";
import { db } from "../firebase/firebase";
import { ref, push, onChildAdded, off, get, set, remove, onValue } from "firebase/database";

function VideoChatRoom({ roomId, userId }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const signalsRef = useRef(null);
  const signalQueue = useRef([]);
  const isProcessing = useRef(false);
  const isInitiatorRef = useRef(false);

  const [stream, setStream] = useState(null);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!started) return;

    signalsRef.current = ref(db, `rooms/${roomId}/signals`);
    const usersRef = ref(db, `rooms/${roomId}/users/${userId}`);
    const initiatorRef = ref(db, `rooms/${roomId}/initiator`);

    set(usersRef, true).catch(err => console.error("Kullanıcı eklenirken hata:", err));

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(async (mediaStream) => {
        setStream(mediaStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStream;
        }

        const initiatorSnap = await get(initiatorRef);
        if (!initiatorSnap.exists()) {
          await set(initiatorRef, userId);
          isInitiatorRef.current = true;
        } else {
          isInitiatorRef.current = initiatorSnap.val() === userId;
        }

        initPeer(mediaStream, isInitiatorRef.current);
      })
      .catch((err) => {
        console.error("Kamera/mikrofon hatası:", err);
        setError("Lütfen kamera ve mikrofona erişime izin verin.");
      });

    return () => {
      if (peerRef.current) peerRef.current.destroy();
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (signalsRef.current) off(signalsRef.current);
      signalQueue.current = [];

      remove(usersRef)
        .then(() => {
          const roomUsersRef = ref(db, `rooms/${roomId}/users`);
          onValue(roomUsersRef, async (snapshot) => {
            if (!snapshot.exists()) {
              await remove(ref(db, `rooms/${roomId}/signals`)).catch(err =>
                console.error("Sinyaller temizlenirken hata:", err)
              );
              await remove(ref(db, `rooms/${roomId}/initiator`)).catch(err =>
                console.error("Initiator temizlenirken hata:", err)
              );
            }
          }, { onlyOnce: true });
        })
        .catch(err => console.error("Kullanıcı çıkışında hata:", err));
    };
  }, [started]);

  const initPeer = (mediaStream, isInitiator) => {
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
      if (msg.from !== userId) {
        signalQueue.current.push(msg.signal);
        processSignalQueue();
      }
    });

    peer.on("stream", (remoteStream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    });

    peer.on("error", (err) => {
      console.error("Peer hatası:", err);
      setError("Bağlantı sırasında bir hata oluştu.");
    });
  };

  const processSignalQueue = async () => {
    if (isProcessing.current || !peerRef.current) return;
    isProcessing.current = true;

    while (signalQueue.current.length > 0) {
      const signal = signalQueue.current[0];
      try {
        const state = peerRef.current._pc?.signalingState;

        if (signal.type === "answer" && state !== "have-local-offer") {
          console.warn("Uygunsuz durumda answer sinyali alındı. Atlaniyor.");
          signalQueue.current.shift();
          continue;
        }

        if (signal.type === "offer" && state !== "stable") {
          console.warn("Offer sinyali için uygun durumda değil. Bekleniyor.");
          break;
        }

        peerRef.current.signal(signal);
        signalQueue.current.shift();
      } catch (err) {
        console.warn("Signal işlenirken hata:", err);
        break;
      }
    }

    isProcessing.current = false;
  };

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
