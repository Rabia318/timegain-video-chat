// src/components/VideoChatRoom.js
import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ref,
  onValue,
  push,
  set,
  off,
  remove,
} from "firebase/database";
import { db, loginAnonymously } from "../firebase/firebase";

const configuration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const VideoChatRoom = () => {
  const { roomId } = useParams();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);

  const [isInitiator, setIsInitiator] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // Anonim giriş
  useEffect(() => {
    loginAnonymously()
      .then(() => console.log("Anonim giriş başarılı"))
      .catch((error) => console.error("Anonim giriş başarısız:", error));
  }, []);

  // Oda kontrolü: veri varsa katılımcı, yoksa başlatıcı
  useEffect(() => {
    if (!roomId) return;

    const roomRef = ref(db, `rooms/${roomId}`);

    const unsubscribe = onValue(
      roomRef,
      (snapshot) => {
        const data = snapshot.val();
        setIsInitiator(!data); // oda yoksa başlatıcıdır
      },
      { onlyOnce: true }
    );

    return () => {
      // Bu dinleyici cleanup önemli
      off(roomRef);
    };
  }, [roomId]);

  useEffect(() => {
    if (isInitiator === null) return;

    const peerConnection = new RTCPeerConnection(configuration);
    peerConnectionRef.current = peerConnection;

    const roomRef = ref(db, `rooms/${roomId}`);

    // Adayları ekleme yardımcı fonksiyonu
    const addCandidate = async (candidate) => {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("ICE adayı eklenemedi:", err);
      }
    };

    // Firebase dinleyici referansları (cleanup için)
    let offerListener, answerListener, initiatorCandidatesListener, receiverCandidatesListener;

    const startConnection = async () => {
      try {
        // Kamera ve mikrofon stream alma
        const localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = localStream;

        // Local videoya stream set et
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }

        // PeerConnection'a stream trakslarını ekle
        localStream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, localStream);
        });

        // Remote stream event
        peerConnection.ontrack = (event) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        // ICE adaylarını Firebase'e push et
        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            const candidateData = event.candidate.toJSON();
            const candidatePath = isInitiator
              ? `rooms/${roomId}/initiatorCandidates`
              : `rooms/${roomId}/receiverCandidates`;
            push(ref(db, candidatePath), candidateData);
          }
        };

        peerConnection.oniceconnectionstatechange = () => {
          console.log("ICE Connection State:", peerConnection.iceConnectionState);
          if (peerConnection.iceConnectionState === "disconnected") {
            setIsConnected(false);
          }
        };

        peerConnection.onconnectionstatechange = () => {
          console.log("Peer Connection State:", peerConnection.connectionState);
          if (peerConnection.connectionState === "connected") {
            setIsConnected(true);
          }
        };

        if (isInitiator) {
          // Başlatıcı: Offer oluştur ve Firebase'e yaz
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          await set(ref(db, `rooms/${roomId}/offer`), offer.toJSON());

          // Yanıt dinle
          answerListener = onValue(
            ref(db, `rooms/${roomId}/answer`),
            async (snapshot) => {
              const answer = snapshot.val();
              if (answer && !peerConnection.currentRemoteDescription) {
                await peerConnection.setRemoteDescription(
                  new RTCSessionDescription(answer)
                );
                console.log("Yanıt ayarlandı.");
              }
            }
          );

          // Alıcı adaylarını dinle
          receiverCandidatesListener = onValue(
            ref(db, `rooms/${roomId}/receiverCandidates`),
            (snapshot) => {
              const candidates = snapshot.val();
              if (candidates) {
                Object.values(candidates).forEach(addCandidate);
              }
            }
          );
        } else {
          // Katılımcı: Teklif dinle
          offerListener = onValue(
            ref(db, `rooms/${roomId}/offer`),
            async (snapshot) => {
              const offer = snapshot.val();
              if (offer && !peerConnection.currentRemoteDescription) {
                await peerConnection.setRemoteDescription(
                  new RTCSessionDescription(offer)
                );
                console.log("Teklif alındı ve ayarlandı.");

                // Yanıt oluştur ve yaz
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                await set(ref(db, `rooms/${roomId}/answer`), answer.toJSON());
                console.log("Yanıt oluşturuldu ve gönderildi.");
              }
            }
          );

          // Başlatıcı adaylarını dinle
          initiatorCandidatesListener = onValue(
            ref(db, `rooms/${roomId}/initiatorCandidates`),
            (snapshot) => {
              const candidates = snapshot.val();
              if (candidates) {
                Object.values(candidates).forEach(addCandidate);
              }
            }
          );
        }
      } catch (err) {
        console.error("Kamera/mikrofon hatası:", err);
        alert(
          "Kamera veya mikrofona erişilemedi. Lütfen izinleri kontrol edin ve sayfayı yenileyin."
        );
      }
    };

    startConnection();

    // Cleanup fonksiyonu: dinleyicileri kapat, peer bağlantıyı kapat, stream durdur
    return () => {
      console.log("Temizlik yapılıyor...");
      if (offerListener) off(ref(db, `rooms/${roomId}/offer`), offerListener);
      if (answerListener) off(ref(db, `rooms/${roomId}/answer`), answerListener);
      if (initiatorCandidatesListener)
        off(ref(db, `rooms/${roomId}/initiatorCandidates`), initiatorCandidatesListener);
      if (receiverCandidatesListener)
        off(ref(db, `rooms/${roomId}/receiverCandidates`), receiverCandidatesListener);

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
    };
  }, [isInitiator, roomId]);

  return (
    <div
      className="video-chat-room"
      style={{
        display: "flex",
        gap: "1rem",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        backgroundColor: "#f7f8fa",
      }}
    >
      <video
        className="local-video"
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: "45%",
          border: "2px solid #a8c0ff",
          borderRadius: "12px",
          backgroundColor: "#000",
        }}
      />
      <video
        className="remote-video"
        ref={remoteVideoRef}
        autoPlay
        playsInline
        style={{
          width: "45%",
          border: "2px solid #a8c0ff",
          borderRadius: "12px",
          backgroundColor: "#000",
        }}
      />
    </div>
  );
};

export default VideoChatRoom;
