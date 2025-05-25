import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ref, onValue, set, push, remove } from "firebase/database";
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
  const [isReady, setIsReady] = useState(false);
  const [isInitiator, setIsInitiator] = useState(false);

  // Anonim giriş
  useEffect(() => {
    loginAnonymously()
      .then(() => setIsReady(true))
      .catch((error) => console.error("Anonim giriş başarısız:", error));
  }, []);

  // Odadaki ilk kullanıcıyı belirle
  useEffect(() => {
    if (!isReady || !roomId) return;

    const roomRef = ref(db, `rooms/${roomId}`);
    onValue(
      roomRef,
      (snapshot) => {
        const data = snapshot.val();
        setIsInitiator(!data); // Eğer odada veri yoksa ilk kişi sensin
      },
      { onlyOnce: true }
    );
  }, [isReady, roomId]);

  // WebRTC kurulumu
  useEffect(() => {
    if (!isReady || roomId == null) return;

    const peerConnection = new RTCPeerConnection(configuration);
    peerConnectionRef.current = peerConnection;

    const roomCandidatesRef = ref(db, `rooms/${roomId}/candidates`);

    const setupMediaAndSignaling = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = stream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        stream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, stream);
        });

        // Remote stream
        const remoteStream = new MediaStream();
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }

        peerConnection.ontrack = (event) => {
          event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
          });
        };

        // ICE candidate
        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            push(roomCandidatesRef, event.candidate.toJSON());
          }
        };

        // Eğer ilk katılan sensen offer oluştur
        if (isInitiator) {
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          await set(ref(db, `rooms/${roomId}/offer`), offer.toJSON());

          // Karşı tarafın cevabını dinle
          onValue(ref(db, `rooms/${roomId}/answer`), async (snapshot) => {
            const answer = snapshot.val();
            if (answer && !peerConnection.currentRemoteDescription) {
              await peerConnection.setRemoteDescription(
                new RTCSessionDescription(answer)
              );
            }
          });
        } else {
          // Teklif varsa al ve cevap oluştur
          onValue(ref(db, `rooms/${roomId}/offer`), async (snapshot) => {
            const offer = snapshot.val();
            if (offer) {
              await peerConnection.setRemoteDescription(
                new RTCSessionDescription(offer)
              );
              const answer = await peerConnection.createAnswer();
              await peerConnection.setLocalDescription(answer);
              await set(ref(db, `rooms/${roomId}/answer`), answer.toJSON());
            }
          });
        }

        // ICE candidates'ı dinle ve ekle
        onValue(roomCandidatesRef, (snapshot) => {
          const candidates = snapshot.val();
          if (candidates) {
            Object.values(candidates).forEach(async (candidate) => {
              try {
                await peerConnection.addIceCandidate(
                  new RTCIceCandidate(candidate)
                );
              } catch (err) {
                console.error("ICE adayı eklenemedi:", err);
              }
            });
          }
        });
      } catch (err) {
        console.error("Kamera/mikrofon hatası:", err);
      }
    };

    setupMediaAndSignaling();

    // Temizlik
    return () => {
      if (peerConnectionRef.current) peerConnectionRef.current.close();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      remove(ref(db, `rooms/${roomId}`));
    };
  }, [isReady, isInitiator, roomId]);

  return (
    <div className="video-chat-room">
      <video ref={localVideoRef} autoPlay playsInline muted className="local-video" />
      <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
    </div>
  );
};

export default VideoChatRoom;
