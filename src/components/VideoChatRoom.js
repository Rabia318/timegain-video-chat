import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { getDatabase, ref, onValue, set } from "firebase/database";
import { getAuth, signInAnonymously } from "firebase/auth";

const VideoChatRoom = () => {
  const { roomId } = useParams();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    signInAnonymously(auth).then(() => {
      initRoom();
    });
  }, []);

  const initRoom = async () => {
    const db = getDatabase();
    const roomRef = ref(db, `rooms/${roomId}`);
    const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideoRef.current.srcObject = localStream;

    const configuration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
    const pc = new RTCPeerConnection(configuration);
    peerConnectionRef.current = pc;

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.onicecandidate = event => {
      if (event.candidate) {
        set(ref(db, `rooms/${roomId}/iceCandidates/${auth.currentUser.uid}`), event.candidate);
      }
    };

    pc.ontrack = event => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    onValue(roomRef, async snapshot => {
      const data = snapshot.val();
      if (!data) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await set(roomRef, { offer });
      } else if (data.offer && !data.answer) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await set(roomRef, { ...data, answer });
      } else if (data.answer && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });

    onValue(ref(db, `rooms/${roomId}/iceCandidates`), snapshot => {
      const candidates = snapshot.val();
      if (candidates) {
        Object.values(candidates).forEach(candidate => {
          pc.addIceCandidate(new RTCIceCandidate(candidate));
        });
      }
    });

    setJoined(true);
  };

  return (
    <div className="video-chat-room">
      <h2 className="room-title">Room ID: {roomId}</h2>
      <div className="video-container">
        <video ref={localVideoRef} autoPlay muted className="video-box" />
        <video ref={remoteVideoRef} autoPlay className="video-box" />
      </div>
      {!joined && <p className="loading-message">Connecting to room...</p>}
    </div>
  );
};

export default VideoChatRoom;