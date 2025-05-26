import React, { useEffect, useRef, useState } from "react";
import { db, loginAnonymously } from "../firebase/firebase";
import {
  ref,
  onValue,
  set,
  remove,
  update,
  get,
  child,
} from "firebase/database";

const servers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    // İstersen burada TURN server ekleyebilirsin
  ],
  iceCandidatePoolSize: 10,
};

const VideoChatRoom = ({ roomId, onLeave }) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const pc = useRef(null);

  const localStream = useRef(null);
  const remoteStream = useRef(null);

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  // Firebase DB paths
  const roomRef = ref(db, `rooms/${roomId}`);

  useEffect(() => {
    // Firebase anonim login
    loginAnonymously().catch((err) => setError("Auth error: " + err.message));
  }, []);

  useEffect(() => {
    const startConnection = async () => {
      try {
        // 1. Medya akışını al
        localStream.current = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        // Local videoya ata
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream.current;
        }

        // 2. Remote stream oluştur
        remoteStream.current = new MediaStream();
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream.current;
        }

        // 3. PeerConnection oluştur
        pc.current = new RTCPeerConnection(servers);

        // 4. Local streamdeki tüm trackleri PeerConnection'a ekle
        localStream.current.getTracks().forEach((track) => {
          pc.current.addTrack(track, localStream.current);
        });

        // 5. Remote stream için track geldiğinde ekle
        pc.current.ontrack = (event) => {
          event.streams[0].getTracks().forEach((track) => {
            remoteStream.current.addTrack(track);
          });
        };

        // 6. ICE candidate Firebase’e gönder
        pc.current.onicecandidate = (event) => {
          if (event.candidate) {
            const candidatesRef = ref(db, `rooms/${roomId}/candidates/${isInitiator ? "caller" : "callee"}`);
            // Yeni ICE candidate’ı Firebase DB’ye ekle
            update(candidatesRef, { [Date.now()]: event.candidate.toJSON() });
          }
        };

        // 7. Oda oluşturma / katılma için kontrol
        const roomSnapshot = await get(roomRef);

        let isInitiator = false;

        if (!roomSnapshot.exists()) {
          // Oda yok, oluştur ve offer gönder
          isInitiator = true;

          pc.current.onnegotiationneeded = async () => {
            const offer = await pc.current.createOffer();
            await pc.current.setLocalDescription(offer);

            const roomWithOffer = {
              offer: {
                type: offer.type,
                sdp: offer.sdp,
              },
            };
            await set(roomRef, roomWithOffer);
          };

          // Cevapları dinle
          onValue(ref(db, `rooms/${roomId}/answer`), async (snapshot) => {
            const data = snapshot.val();
            if (data && data.sdp && pc.current.signalingState !== "stable") {
              const answerDesc = new RTCSessionDescription(data);
              await pc.current.setRemoteDescription(answerDesc);
              setIsConnected(true);
            }
          });

          // Karşı taraf ICE candidate'larını dinle
          onValue(ref(db, `rooms/${roomId}/candidates/callee`), (snapshot) => {
            const candidates = snapshot.val();
            if (candidates) {
              Object.values(candidates).forEach(async (candidate) => {
                try {
                  await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) {
                  console.error("Error adding callee candidate:", e);
                }
              });
            }
          });

        } else {
          // Oda var, katılan taraf
          isInitiator = false;

          // Offer’ı al
          const offer = roomSnapshot.val().offer;
          if (!offer) throw new Error("Offer not found in room");

          await pc.current.setRemoteDescription(new RTCSessionDescription(offer));

          // Cevap oluştur ve gönder
          const answer = await pc.current.createAnswer();
          await pc.current.setLocalDescription(answer);

          await update(roomRef, {
            answer: {
              type: answer.type,
              sdp: answer.sdp,
            },
          });

          // Karşı taraf ICE candidate'larını dinle
          onValue(ref(db, `rooms/${roomId}/candidates/caller`), (snapshot) => {
            const candidates = snapshot.val();
            if (candidates) {
              Object.values(candidates).forEach(async (candidate) => {
                try {
                  await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) {
                  console.error("Error adding caller candidate:", e);
                }
              });
            }
          });

          // Kendi ICE candidate’larını gönder
          pc.current.onicecandidate = (event) => {
            if (event.candidate) {
              const candidatesRef = ref(db, `rooms/${roomId}/candidates/callee`);
              update(candidatesRef, { [Date.now()]: event.candidate.toJSON() });
            }
          };

          setIsConnected(true);
        }
      } catch (err) {
        setError("Connection error: " + err.message);
        console.error(err);
      }
    };

    if (roomId) {
      startConnection();
    }

    // Cleanup (odadan çıkışta)
    return () => {
      if (pc.current) {
        pc.current.close();
      }
      remove(roomRef);
      setIsConnected(false);
    };
  }, [roomId]);

  return (
    <div className="video-chat-room">
      <div>
        <h2>Room: {roomId}</h2>
        {error && <p style={{ color: "red" }}>Error: {error}</p>}
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="local-video"
        />
      </div>
      <div>
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="remote-video"
        />
      </div>
      <button onClick={onLeave} className="join-button" style={{marginTop:"20px"}}>
        Leave Room
      </button>
    </div>
  );
};

export default VideoChatRoom;
