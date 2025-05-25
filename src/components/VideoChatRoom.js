import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ref, onValue, set, push, remove } from "firebase/database";
import { db, loginAnonymously } from "../firebase";

const configuration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const VideoChatRoom = () => {
  const { roomId } = useParams();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const [isInitiator, setIsInitiator] = useState(null);

  useEffect(() => {
    loginAnonymously().catch((error) =>
      console.error("Anonim giriş başarısız:", error)
    );
  }, []);

  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomId}`);
    onValue(
      roomRef,
      (snapshot) => {
        const data = snapshot.val();
        setIsInitiator(!data);
      },
      { onlyOnce: true }
    );
  }, [roomId]);

  useEffect(() => {
    if (isInitiator === null) return;

    const peerConnection = new RTCPeerConnection(configuration);
    peerConnectionRef.current = peerConnection;

    let localStream;

    const startConnection = async () => {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

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
            const candidatesRef = ref(db, `rooms/${roomId}/candidates`);
            push(candidatesRef, event.candidate.toJSON());
          }
        };

        if (isInitiator) {
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          set(ref(db, `rooms/${roomId}/offer`), offer.toJSON());

          onValue(ref(db, `rooms/${roomId}/answer`), async (snapshot) => {
            const answer = snapshot.val();
            if (answer) {
              await peerConnection.setRemoteDescription(
                new RTCSessionDescription(answer)
              );
            }
          });
        } else {
          onValue(ref(db, `rooms/${roomId}/offer`), async (snapshot) => {
            const offer = snapshot.val();
            if (offer) {
              await peerConnection.setRemoteDescription(
                new RTCSessionDescription(offer)
              );
              const answer = await peerConnection.createAnswer();
              await peerConnection.setLocalDescription(answer);
              set(ref(db, `rooms/${roomId}/answer`), answer.toJSON());
            }
          });
        }

        const candidatesRef = ref(db, `rooms/${roomId}/candidates`);
        onValue(candidatesRef, (snapshot) => {
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

    startConnection();

    return () => {
      peerConnection.close();
      if (localVideoRef.current?.srcObject) {
        localVideoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
      remove(ref(db, `rooms/${roomId}`));
    };
  }, [isInitiator, roomId]);

  return (
    <div className="video-chat-room">
      <video className="local-video" ref={localVideoRef} autoPlay playsInline muted />
      <video className="remote-video" ref={remoteVideoRef} autoPlay playsInline />
    </div>
  );
};

export default VideoChatRoom;
