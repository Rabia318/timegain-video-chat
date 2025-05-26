import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ref, onValue, push, set, off } from "firebase/database";
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

  // Anonim Firebase giriş
  useEffect(() => {
    loginAnonymously()
      .then(() => console.log("Anonim giriş başarılı"))
      .catch((error) => console.error("Anonim giriş başarısız:", error));
  }, []);

  // Odanın varlığını kontrol et ve başlatıcı mı katılımcı mı belirle
  useEffect(() => {
    if (!roomId) return;

    const roomRef = ref(db, `rooms/${roomId}`);
    onValue(
      roomRef,
      (snapshot) => {
        const data = snapshot.val();
        setIsInitiator(!data); // Oda yoksa başlatıcıdır
      },
      { onlyOnce: true }
    );

    return () => off(roomRef);
  }, [roomId]);

  useEffect(() => {
    if (isInitiator === null) return;

    const peerConnection = new RTCPeerConnection(configuration);
    peerConnectionRef.current = peerConnection;
    const roomRef = ref(db, `rooms/${roomId}`);

    // ICE adaylarını eklemek için yardımcı fonksiyon
    const addCandidate = async (candidate) => {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("ICE adayı eklenemedi:", error);
      }
    };

    let offerListener, answerListener, initiatorCandidatesListener, receiverCandidatesListener;

    const startConnection = async () => {
      try {
        // Kamera ve mikrofon erişimi al
        const localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = localStream;

        // Yerel video akışını ayarla
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }

        // Tüm track'leri peer connection'a ekle
        localStream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, localStream);
        });

        // Remote stream event listener
        peerConnection.ontrack = (event) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        // ICE adaylarını Firebase'e gönder
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
          if (peerConnection.iceConnectionState === "disconnected") {
            setIsConnected(false);
          }
        };

        peerConnection.onconnectionstatechange = () => {
          if (peerConnection.connectionState === "connected") {
            setIsConnected(true);
          }
        };

        if (isInitiator) {
          // Başlatıcı: Offer oluştur, gönder, yanıt dinle ve alıcı adaylarını dinle
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          await set(ref(db, `rooms/${roomId}/offer`), offer.toJSON());

          answerListener = onValue(ref(db, `rooms/${roomId}/answer`), async (snapshot) => {
            const answer = snapshot.val();
            if (answer && !peerConnection.currentRemoteDescription) {
              await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
              console.log("Yanıt ayarlandı.");
            }
          });

          receiverCandidatesListener = onValue(ref(db, `rooms/${roomId}/receiverCandidates`), (snapshot) => {
            const candidates = snapshot.val();
            if (candidates) {
              Object.values(candidates).forEach(addCandidate);
            }
          });
        } else {
          // Katılımcı: Teklif dinle, yanıt oluştur, başlatıcı adaylarını dinle
          offerListener = onValue(ref(db, `rooms/${roomId}/offer`), async (snapshot) => {
            const offer = snapshot.val();
            if (offer && !peerConnection.currentRemoteDescription) {
              await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
              console.log("Teklif ayarlandı.");

              const answer = await peerConnection.createAnswer();
              await peerConnection.setLocalDescription(answer);
              await set(ref(db, `rooms/${roomId}/answer`), answer.toJSON());
              console.log("Yanıt gönderildi.");
            }
          });

          initiatorCandidatesListener = onValue(ref(db, `rooms/${roomId}/initiatorCandidates`), (snapshot) => {
            const candidates = snapshot.val();
            if (candidates) {
              Object.values(candidates).forEach(addCandidate);
            }
          });
        }
      } catch (error) {
        console.error("Kamera/mikrofon erişim hatası:", error);
        alert(
          "Kamera veya mikrofona erişilemedi. Lütfen izinleri kontrol edin ve sayfayı yenileyin."
        );
      }
    };

    startConnection();

    // Temizlik
    return () => {
      if (offerListener) off(ref(db, `rooms/${roomId}/offer`), offerListener);
      if (answerListener) off(ref(db, `rooms/${roomId}/answer`), answerListener);
      if (initiatorCandidatesListener) off(ref(db, `rooms/${roomId}/initiatorCandidates`), initiatorCandidatesListener);
      if (receiverCandidatesListener) off(ref(db, `rooms/${roomId}/receiverCandidates`), receiverCandidatesListener);

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
    <div className="video-chat-room">
      <video
        className="local-video"
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        style={{ border: "3px solid #3da5d9", borderRadius: "10px" }}
      />
      <video
        className="remote-video"
        ref={remoteVideoRef}
        autoPlay
        playsInline
        style={{ border: "3px solid #084c61", borderRadius: "10px" }}
      />
    </div>
  );
};

export default VideoChatRoom;
