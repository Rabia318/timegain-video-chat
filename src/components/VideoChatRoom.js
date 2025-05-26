import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ref, onValue, push, set } from "firebase/database";
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

  // Anonim giriş
  useEffect(() => {
    loginAnonymously()
      .then(() => console.log("Anonim giriş başarılı"))
      .catch((error) => console.error("Anonim giriş başarısız:", error));
  }, []);

  // Oda kontrolü (başlatıcı mı katılımcı mı)
  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomId}`);
    onValue(
      roomRef,
      (snapshot) => {
        const data = snapshot.val();
        setIsInitiator(!data); // veri yoksa başlatıcı
      },
      { onlyOnce: true }
    );
  }, [roomId]);

  useEffect(() => {
    if (isInitiator === null) return;

    const peerConnection = new RTCPeerConnection(configuration);
    peerConnectionRef.current = peerConnection;

    const startConnection = async () => {
      try {
        const localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = localStream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }

        localStream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, localStream);
        });

        peerConnection.ontrack = (event) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

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
        };

        peerConnection.onconnectionstatechange = () => {
          console.log("Peer Connection State:", peerConnection.connectionState);
        };

        if (isInitiator) {
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          await set(ref(db, `rooms/${roomId}/offer`), offer.toJSON());

          onValue(ref(db, `rooms/${roomId}/answer`), async (snapshot) => {
            const answer = snapshot.val();
            if (answer) {
              await peerConnection.setRemoteDescription(
                new RTCSessionDescription(answer)
              );
              console.log("Yanıt ayarlandı.");
            }
          });

          onValue(ref(db, `rooms/${roomId}/receiverCandidates`), async (snapshot) => {
            const candidates = snapshot.val();
            if (candidates) {
              for (const key in candidates) {
                const candidate = new RTCIceCandidate(candidates[key]);
                try {
                  await peerConnection.addIceCandidate(candidate);
                } catch (err) {
                  console.error("ICE adayı eklenemedi:", err);
                }
              }
            }
          });
        } else {
          onValue(ref(db, `rooms/${roomId}/offer`), async (snapshot) => {
            const offer = snapshot.val();
            if (offer) {
              await peerConnection.setRemoteDescription(
                new RTCSessionDescription(offer)
              );
              console.log("Teklif alındı ve ayarlandı.");

              const answer = await peerConnection.createAnswer();
              await peerConnection.setLocalDescription(answer);
              await set(ref(db, `rooms/${roomId}/answer`), answer.toJSON());
              console.log("Yanıt oluşturuldu ve gönderildi.");
            }
          });

          onValue(ref(db, `rooms/${roomId}/initiatorCandidates`), async (snapshot) => {
            const candidates = snapshot.val();
            if (candidates) {
              for (const key in candidates) {
                const candidate = new RTCIceCandidate(candidates[key]);
                try {
                  await peerConnection.addIceCandidate(candidate);
                } catch (err) {
                  console.error("ICE adayı eklenemedi:", err);
                }
              }
            }
          });
        }
      } catch (err) {
        console.error("Kamera/mikrofon hatası:", err);
        alert("Kamera veya mikrofona erişilemedi.");
      }
    };

    startConnection();

    return () => {
      console.log("Temizlik yapılıyor...");
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      // ❌ Oda verileri artık silinmiyor, Firebase'de kalacak
      // remove(ref(db, `rooms/${roomId}`));
    };
  }, [isInitiator, roomId]);

  return (
    <div className="video-chat-room" style={{ display: "flex", gap: "1rem" }}>
      <video
        className="local-video"
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        style={{ width: "45%", border: "2px solid #ccc", borderRadius: "10px" }}
      />
      <video
        className="remote-video"
        ref={remoteVideoRef}
        autoPlay
        playsInline
        style={{ width: "45%", border: "2px solid #ccc", borderRadius: "10px" }}
      />
    </div>
  );
};

export default VideoChatRoom;
