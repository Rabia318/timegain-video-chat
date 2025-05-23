import React, { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";
import { db } from "../firebase/firebase";
import { ref, push, onChildAdded, get } from "firebase/database";

function VideoChatRoom({ roomId, userId }) {
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const peerRef = useRef();
  const [stream, setStream] = useState(null);
  const [isStarted, setIsStarted] = useState(false);

  useEffect(() => {
    if (!isStarted || !stream) return;

    const signalsRef = ref(db, `rooms/${roomId}/signals`);
    const initiatorRef = ref(db, `rooms/${roomId}/initiator`);

    // İlk gelen kullanıcı initiator olacak
    get(initiatorRef).then(snapshot => {
      const initiator = snapshot.val();
      const isInitiator = !initiator;

      if (isInitiator) {
        push(initiatorRef, userId); // kendini initiator olarak yaz
      }

      startPeer(stream, isInitiator, signalsRef);
    });

    return () => {
      if (peerRef.current) peerRef.current.destroy();
      if (stream) stream.getTracks().forEach(track => track.stop());
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
        console.error("Kamera/mikrofon hatası:", err);
        alert("Lütfen kamera ve mikrofona izin verin.");
      });
  }

  function startPeer(mediaStream, isInitiator, signalsRef) {
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
