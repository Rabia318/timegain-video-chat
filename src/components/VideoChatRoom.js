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

  const [isInitiator, setIsInitiator] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);

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

  const getUserMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      setHasPermission(true);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Kamera/mikrofon hatası:", err);
      alert("Kamera ve mikrofon izinleri gerekli!");
    }
  };

  useEffect(() => {
    if (!hasPermission || isInitiator === null) return;

    const peerConnection = new RTCPeerConnection(configuration);
    peerConnectionRef.current = peerConnection;

    // Yerel stream parçalarını ekle
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    // Karşı tarafın streamini al
    peerConnection.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // ICE adaylarını Firebase'e gönder
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const candidatesRef = ref(db, `rooms/${roomId}/candidates`);
        push(candidatesRef, event.candidate.toJSON());
      }
    };

    const setupSignaling = async () => {
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
            await set(ref(db, `rooms/${roomId}/answer`), answer.toJSON());
          }
        });
      }

      const candidatesRef = ref(db, `rooms/${roomId}/candidates`);
      onValue(candidatesRef, (snapshot) => {
        const candidates = snapshot.val();
        if (candidates) {
          Object.values(candidates).forEach(async (candidate) => {
            try {
              await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
              console.error("ICE adayı eklenemedi:", err);
            }
          });
        }
      });
    };

    setupSignaling();

    return () => {
      peerConnection.close();
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      remove(ref(db, `rooms/${roomId}`));
    };
  }, [hasPermission, isInitiator, localStream, roomId]);

  return (
    <div className="video-chat-room">
      {!hasPermission ? (
        <button onClick={getUserMedia} style={{ fontSize: "1.2rem", padding: "10px 20px" }}>
          Kamera ve Mikrofon İzni Ver
        </button>
      ) : null}
      <video
        className="local-video"
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        style={{ display: hasPermission ? "block" : "none" }}
      />
      <video
        className="remote-video"
        ref={remoteVideoRef}
        autoPlay
        playsInline
        style={{ display: hasPermission ? "block" : "none" }}
      />
    </div>
  );
};

export default VideoChatRoom;
