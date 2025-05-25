import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase/firebase";
import { ref, onValue, push, remove, set } from "firebase/database";

const servers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    // Gerekirse TURN sunucu ekle
  ],
};

const VideoChatRoom = ({ roomId, userId }) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pc = useRef(null);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!started) return;

    pc.current = new RTCPeerConnection(servers);

    // ICE Candidate'ları Firebase'e göndermek için referanslar
    const candidatesRef = ref(db, `rooms/${roomId}/candidates/${userId}`);

    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        // Push ile her yeni candidate ayrı ayrı ekleniyor
        push(candidatesRef, event.candidate.toJSON());
      }
    };

    // Karşı tarafın medya akışını yakala
    pc.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Kullanıcının kamerasını aç ve stream'i RTCPeerConnection'a ekle
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        // Local videoya yayınla
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Tüm stream parçalarını peer connection'a ekle
        stream.getTracks().forEach((track) => {
          pc.current.addTrack(track, stream);
        });

        const signalRef = ref(db, `rooms/${roomId}/signal`);

        // Signal değişikliklerini dinle
        onValue(signalRef, async (snapshot) => {
          const data = snapshot.val();

          // Eğer signal yoksa (oda boş), bu kullanıcı başlatıcı (offer oluşturur)
          if (!data) {
            const offer = await pc.current.createOffer();
            await pc.current.setLocalDescription(offer);
            await set(signalRef, { offer, caller: userId });
          }
          // Eğer offer varsa ve answer yoksa, bu kullanıcı alıcıdır (answer oluşturur)
          else if (data.offer && !data.answer && data.caller !== userId) {
            await pc.current.setRemoteDescription(data.offer);
            const answer = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answer);
            await set(signalRef, { ...data, answer, callee: userId });
          }
          // Eğer answer varsa ve local remote description yoksa, başlatıcı cevabı set eder
          else if (data.answer && pc.current.remoteDescription === null && data.caller === userId) {
            await pc.current.setRemoteDescription(data.answer);
          }
        });

        // Diğer kullanıcının ICE candidate'larını dinle ve ekle
        const otherUserId = userId === "user1" ? "user2" : "user1"; // Basit kullanıcı ayrımı, geliştirilebilir
        const otherCandidatesRef = ref(db, `rooms/${roomId}/candidates/${otherUserId}`);

        onValue(otherCandidatesRef, (snapshot) => {
          const candidates = snapshot.val();
          if (candidates) {
            Object.values(candidates).forEach((candidate) => {
              pc.current.addIceCandidate(candidate).catch((e) => {
                console.error("ICE candidate ekleme hatası:", e);
              });
            });
          }
        });
      })
      .catch((err) => {
        console.error("Kamera/mikrofon erişim hatası:", err);
        setError("Kamera veya mikrofon erişimi reddedildi.");
      });

    // Temizlik - sayfa kapandığında peer connection ve DB referansları temizlenir
    return () => {
      remove(ref(db, `rooms/${roomId}/candidates/${userId}`));
      remove(ref(db, `rooms/${roomId}/signal`));
      if (pc.current) {
        pc.current.close();
      }
    };
  }, [started, roomId, userId]);

  return (
    <div className="video-chat-room">
      <h2 className="room-title">Oda: {roomId}</h2>

      {!started && (
        <div className="btn-container">
          <button className="btn-primary" onClick={() => { setStarted(true); setError(""); }}>
            Kamerayı Aç ve Bağlan
          </button>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      {started && (
        <div className="videos-container">
          <div>
            <h3>Sen</h3>
            <video
              ref={localVideoRef}
              muted
              autoPlay
              playsInline
              className="video-box"
            />
          </div>
          <div>
            <h3>Karşı Taraf</h3>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="video-box"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoChatRoom;
