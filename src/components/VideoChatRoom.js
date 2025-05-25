import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase/firebase";
import { ref, onValue, push, set, remove } from "firebase/database";
import "../index.css";

const VideoChatRoom = ({ roomId, userId }) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState("");
  const pc = useRef(null);
  const localStream = useRef(null);

  useEffect(() => {
    if (!started) return;

    const servers = {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };

    pc.current = new RTCPeerConnection(servers);

    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        const candidateRef = ref(db, `rooms/${roomId}/candidates/${userId}`);
        push(candidateRef, event.candidate.toJSON());
      }
    };

    pc.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then(async (stream) => {
        localStream.current = stream;

        stream.getTracks().forEach((track) => {
          pc.current.addTrack(track, stream);
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const signalRef = ref(db, `rooms/${roomId}/signal`);
        onValue(signalRef, async (snapshot) => {
          const data = snapshot.val();
          if (!data) {
            const offer = await pc.current.createOffer();
            await pc.current.setLocalDescription(offer);
            await set(signalRef, { offer });
          } else if (data.offer && !data.answer) {
            await pc.current.setRemoteDescription(data.offer);
            const answer = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answer);
            await set(signalRef, { ...data, answer });
          } else if (data.answer && !pc.current.remoteDescription) {
            await pc.current.setRemoteDescription(data.answer);
          }
        });

        const otherCandidatesRef = ref(
          db,
          `rooms/${roomId}/candidates/${userId === "user1" ? "user2" : "user1"}`
        );

        onValue(otherCandidatesRef, (snapshot) => {
          snapshot.forEach((child) => {
            const candidate = new RTCIceCandidate(child.val());
            pc.current.addIceCandidate(candidate);
          });
        });
      })
      .catch((err) => {
        console.error("Media error:", err);
        setError("Kamera/mikrofon erişimi reddedildi.");
      });

    return () => {
      if (localStream.current) {
        localStream.current.getTracks().forEach((t) => t.stop());
      }
      remove(ref(db, `rooms/${roomId}/candidates/${userId}`));
      pc.current.close();
    };
  }, [started, roomId, userId]);

  return (
    <div className="room-container">
      <h2 className="room-title">Oda: {roomId}</h2>

      {!started && (
        <div className="centered">
          <button className="btn-primary" onClick={() => setStarted(true)}>
            Kamerayı Aç ve Bağlan
          </button>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      {started && (
        <div className="video-wrapper">
          <div className="video-box">
            <h3>Sen</h3>
            <video ref={localVideoRef} muted autoPlay playsInline className="video" />
          </div>
          <div className="video-box">
            <h3>Karşı Taraf</h3>
            <video ref={remoteVideoRef} autoPlay playsInline className="video" />
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoChatRoom;
