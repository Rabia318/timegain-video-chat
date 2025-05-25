// src/components/VideoChatRoom.js
import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase/firebase";
import { ref, onValue, set, remove } from "firebase/database";

const VideoChatRoom = ({ roomId, userId }) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState("");

  const pc = useRef(null);

  useEffect(() => {
    if (!started) return;

    const servers = {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };

    pc.current = new RTCPeerConnection(servers);

    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        set(ref(db, `rooms/${roomId}/candidates/${userId}`), event.candidate.toJSON());
      }
    };

    pc.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
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
            // Bu kullanıcı başlatıcı
            const offer = await pc.current.createOffer();
            await pc.current.setLocalDescription(offer);
            await set(signalRef, { offer });
          } else if (data.offer && !data.answer) {
            // Bu kullanıcı alıcı
            await pc.current.setRemoteDescription(data.offer);
            const answer = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answer);
            await set(signalRef, { ...data, answer });
          } else if (data.answer && !pc.current.currentRemoteDescription) {
            // Başlatıcı cevabı alır
            await pc.current.setRemoteDescription(data.answer);
          }
        });
      })
      .catch((err) => {
        console.error("Kamera/mikrofon hatası:", err);
        setError("Kamera/mikrofon erişimi reddedildi.");
      });

    return () => {
      remove(ref(db, `rooms/${roomId}/candidates/${userId}`));
      pc.current.close();
    };
  }, [started]);

  return (
    <div style={{
      maxWidth: "900px",
      margin: "30px auto",
      padding: "20px",
      borderRadius: "12px",
      backgroundColor: "#fff",
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
    }}>
      <h2 style={{ textAlign: "center" }}>Oda: {roomId}</h2>

      {!started && (
        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <button
            onClick={() => { setStarted(true); setError(""); }}
            style={{
              padding: "10px 24px",
              fontSize: "16px",
              backgroundColor: "#007bff",
              color: "white",
              borderRadius: "8px",
              cursor: "pointer"
            }}
          >
            Kamerayı Aç ve Bağlan
          </button>
        </div>
      )}

      {error && (
        <p style={{ color: "red", textAlign: "center", marginTop: "15px" }}>
          {error}
        </p>
      )}

      {started && (
        <div style={{
          display: "flex",
          justifyContent: "space-around",
          marginTop: "30px",
          gap: "30px"
        }}>
          <div style={{ textAlign: "center" }}>
            <h3>Sen</h3>
            <video ref={localVideoRef} muted autoPlay playsInline style={{
              width: "350px",
              height: "auto",
              borderRadius: "12px",
              backgroundColor: "#000"
            }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <h3>Karşı Taraf</h3>
            <video ref={remoteVideoRef} autoPlay playsInline style={{
              width: "350px",
              height: "auto",
              borderRadius: "12px",
              backgroundColor: "#000"
            }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoChatRoom;