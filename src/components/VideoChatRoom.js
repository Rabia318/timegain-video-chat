import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ref, onValue, set, push, remove, off } from "firebase/database";
import { db, loginAnonymously } from "../firebase/firebase";

const configuration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const VideoChatRoom = () => {
  const { roomId } = useParams();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const [isInitiator, setIsInitiator] = useState(null);
  const [cameraAllowed, setCameraAllowed] = useState(false);

  // Firebase refs
  const roomRef = ref(db, `rooms/${roomId}`);
  const offerRef = ref(db, `rooms/${roomId}/offer`);
  const answerRef = ref(db, `rooms/${roomId}/answer`);
  const candidatesRef = ref(db, `rooms/${roomId}/candidates`);

  // Anonim giriş
  useEffect(() => {
    loginAnonymously().catch((error) =>
      console.error("Anonim giriş başarısız:", error)
    );
  }, []);

  // Kim başlatıcı kontrolü
  useEffect(() => {
    onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      setIsInitiator(!data);
    }, { onlyOnce: true });

    return () => off(roomRef);
  }, [roomId]);

  // Kamera izni ve local stream alma fonksiyonu
  const getUserMediaStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setCameraAllowed(true);
      return stream;
    } catch (error) {
      console.error("Kamera/mikrofon izni alınamadı:", error);
      alert("Lütfen kamera ve mikrofon izni verin.");
      return null;
    }
  };

  // Temel WebRTC bağlantı ayarları
  useEffect(() => {
    if (isInitiator === null) return;

    let peerConnection = new RTCPeerConnection(configuration);
    peerConnectionRef.current = peerConnection;

    let remoteStream = new MediaStream();
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;

    // Local stream varsa ekle, yoksa iste
    const setupConnection = async () => {
      let stream = localStream;
      if (!stream) {
        stream = await getUserMediaStream();
        if (!stream) return; // izin alınmadıysa çık
      }

      // Local trackleri ekle
      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      // Remote trackleri dinle ve ekle
      peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
          remoteStream.addTrack(track);
        });
      };

      // ICE adaylarını gönder
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          push(candidatesRef, event.candidate.toJSON());
        }
      };

      if (isInitiator) {
        // Offer oluştur ve gönder
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        await set(offerRef, offer.toJSON());

        // Answer bekle ve al
        onValue(answerRef, async (snapshot) => {
          const answer = snapshot.val();
          if (answer) {
            await peerConnection.setRemoteDescription(
              new RTCSessionDescription(answer)
            );
          }
        });
      } else {
        // Offer bekle ve al
        onValue(offerRef, async (snapshot) => {
          const offer = snapshot.val();
          if (!offer) return;
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(offer)
          );

          // Answer oluştur ve gönder
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          await set(answerRef, answer.toJSON());
        });
      }

      // ICE adaylarını dinle ve ekle
      onValue(candidatesRef, (snapshot) => {
        const candidates = snapshot.val();
        if (candidates) {
          Object.values(candidates).forEach(async (candidate) => {
            try {
              await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.error("ICE adayı eklenemedi:", e);
            }
          });
        }
      });
    };

    setupConnection();

    // Temizlik fonksiyonu
    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      if (localVideoRef.current?.srcObject) {
        localVideoRef.current.srcObject.getTracks().forEach((t) => t.stop());
        localVideoRef.current.srcObject = null;
      }
      if (remoteVideoRef.current?.srcObject) {
        remoteVideoRef.current.srcObject.getTracks().forEach((t) => t.stop());
        remoteVideoRef.current.srcObject = null;
      }

      remove(roomRef);
      off(offerRef);
      off(answerRef);
      off(candidatesRef);
    };
  }, [isInitiator, localStream, roomId]);

  // Kamera izin butonu ve video gösterimi
  if (!cameraAllowed) {
    return (
      <div style={{ textAlign: "center", marginTop: "50px" }}>
        <h2>Kamera ve mikrofon izni gerekiyor</h2>
        <button onClick={getUserMediaStream} style={{ padding: "10px 20px" }}>
          İzin Ver
        </button>
      </div>
    );
  }

  // Video chat ekranı
  return (
    <div className="video-chat-room">
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className="local-video"
      />
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="remote-video"
      />
    </div>
  );
};

export default VideoChatRoom;
