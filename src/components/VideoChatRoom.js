import React, { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";
import { db } from "../firebase/firebase";
import { ref, push, onChildAdded, get } from "firebase/database";

function VideoChatRoom({ roomId, userId }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isStarted, setIsStarted] = useState(false);

  // Kamera ve mikrofon erişimini başlat
  function startMedia() {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then(mediaStream => {
        setStream(mediaStream);
        setIsStarted(true);
      })
      .catch(err => {
        console.error("Kamera/mikrofon erişim hatası:", err);
        alert("Kamera ve mikrofona erişim izni vermeniz gerekiyor.");
      });
  }

  // stream geldiğinde yerel videoyu bağla
  useEffect(() => {
    if (localVideoRef.current && stream) {
      localVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Peer bağlantısı kur
  useEffect(() => {
    if (!isStarted || !stream) return;

    const signalsRef = ref(db, `rooms/${roomId}/signals`);
    const initiatorRef = ref(db, `rooms/${roomId}/initiator`);

    let isInitiator = true;

    get(initiatorRef).then(snapshot => {
      if (snapshot.exists()) {
        isInitiator = false;
      }
      // Kendini listeye ekle
      push(initiatorRef, userId);

      startPeer(stream, isInitiator, signalsRef);
    });

    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isStarted, stream]);

  // Peer objesini oluştur
  function startPeer(mediaStream, isInitiator, signalsRef) {
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
            credential: "openai"
          }
        ]
      }
    });

    peerRef.current = peer;

    peer.on("signal", data => {
      push(signalsRef, {
        from: userId,
        signal: data
      });
    });

    onChildAdded(signalsRef, snapshot => {
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
      console.error("Peer hatası:", err);
    });
  }

  return (
    <div>
      {!isStarted && (
        <button onClick={startMedia}>Kamerayı Aç ve İzin Ver</button>
      )}
      {isStarted && (
        <div>
          <h3>Sen</h3>
          <video
            ref={localVideoRef}
            muted
            autoPlay
            playsInline
            style={{ width: 300 }}
          />
          <h3>Karşı Taraf</h3>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{ width: 300 }}
          />
        </div>
      )}
    </div>
  );
}

export default VideoChatRoom;
