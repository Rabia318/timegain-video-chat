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
    if (!isStarted) return;

    let isInitiator = false;
    const signalsRef = ref(db, `rooms/${roomId}/signals`);
    get(signalsRef).then(snapshot => {
      const signals = snapshot.val();
      isInitiator = !signals;
      startPeer(stream, isInitiator);
    });

    return () => {
      if (peerRef.current) peerRef.current.destroy();
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [isStarted]);

  function startMedia() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
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
    } else {
      alert("Tarayıcınız getUserMedia desteği sunmuyor.");
    }
  }

  function startPeer(mediaStream, isInitiator) {
    const signalsRef = ref(db, `rooms/${roomId}/signals`);

    const peer = new Peer({
      initiator: isInitiator,
      trickle: false,
      stream: mediaStream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          {
            urls: 'turn:global.relay.metered.ca:443',
            username: 'openai',
            credential: 'openai'
          }
        ]
      }
    });

    peerRef.current = peer;

    peer.on("signal", data => {
      push(signalsRef, {
        from: userId,
        signal: data,
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
  }

  return (
    <div>
      {!isStarted && (
        <button onClick={startMedia}>
          Kamerayı Aç ve İzin Ver
        </button>
      )}
      <div style={{ display: isStarted ? "block" : "none" }}>
        <video
          ref={localVideoRef}
          muted
          autoPlay
          playsInline
          style={{ width: 300 }}
        />
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{ width: 300 }}
        />
      </div>
    </div>
  );
}

export default VideoChatRoom;
