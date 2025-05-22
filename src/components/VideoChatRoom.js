import React, { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";
import { db } from "../firebase/firebase";
import { ref, push, onChildAdded } from "firebase/database";

function VideoChatRoom({ roomId, userId }) {
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const peerRef = useRef();
  const [stream, setStream] = useState(null);
  const [isStarted, setIsStarted] = useState(false);

  useEffect(() => {
    if (!isStarted || !stream) return;

    const signalsRef = ref(db, `rooms/${roomId}/signals`);
    const initiatorCheckRef = ref(db, `rooms/${roomId}/initiator`);

    let isInitiator = false;

    // İlk kullanıcıyı belirle
    onChildAdded(initiatorCheckRef, snapshot => {
      isInitiator = false;
    });

    push(initiatorCheckRef, userId).then(() => {
      isInitiator = true;
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

  function startMedia() {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then(mediaStream => {
        setStream(mediaStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStream;
        }
        setIsStarted(true);
      })
      .catch(err => {
        console.error("Kamera/mikrofon erişim hatası:", err);
        alert("Kamera ve mikrofon erişimini lütfen izin veriniz.");
      });
  }

  function startPeer(mediaStream, isInitiator, signalsRef) {
    const peer = new Peer({
      initiator: isInitiator,
      trickle: true, // ÖNEMLİ: Bağlantının sorunsuz kurulması için
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
      console.log("Signal gönderildi:", data);
      push(signalsRef, {
        from: userId,
        signal: data
      });
    });

    onChildAdded(signalsRef, snapshot => {
      const msg = snapshot.val();
      if (msg.from !== userId) {
        console.log("Karşıdan signal geldi:", msg);
        peer.signal(msg.signal);
      }
    });

    peer.on("stream", remoteStream => {
      console.log("Karşı tarafın yayını geldi.");
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    });

    peer.on("error", err => {
      console.error("Peer error:", err);
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
          <h3>Karşı taraf</h3>
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
