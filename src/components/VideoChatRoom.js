import React, { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";
import { db } from "../firebase";
import { ref, push, onChildAdded, remove } from "firebase/database";

function VideoChatRoom({ roomId, userId }) {
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const peerRef = useRef();
  const [stream, setStream] = useState(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(mediaStream => {
        setStream(mediaStream);
        localVideoRef.current.srcObject = mediaStream;
        startPeer(mediaStream);
      })
      .catch(console.error);

    return () => {
      if (peerRef.current) peerRef.current.destroy();
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  function startPeer(mediaStream) {
    const signalsRef = ref(db, `rooms/${roomId}/signals`);

    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: mediaStream
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
      remoteVideoRef.current.srcObject = remoteStream;
    });
  }

  return (
    <div>
      <video ref={localVideoRef} muted autoPlay playsInline style={{ width: 300 }} />
      <video ref={remoteVideoRef} autoPlay playsInline style={{ width: 300 }} />
    </div>
  );
}

export default VideoChatRoom;
