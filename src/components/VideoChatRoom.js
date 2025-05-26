import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ref, onValue, set, remove, push, off } from "firebase/database";
import { db, loginAnonymously, auth } from "../firebase/firebase";
import "../index.css";

const configuration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function VideoChatRoom() {
  const { roomName } = useParams();
  const navigate = useNavigate();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);

  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isConnected, setIsConnected] = useState(false);

  // Firebase paths
  const roomRef = ref(db, `rooms/${roomName}`);
  const offerRef = ref(db, `rooms/${roomName}/offer`);
  const answerRef = ref(db, `rooms/${roomName}/answer`);
  const initiatorCandidatesRef = ref(db, `rooms/${roomName}/initiatorCandidates`);
  const receiverCandidatesRef = ref(db, `rooms/${roomName}/receiverCandidates`);

  const cleanupFirebaseListeners = () => {
    off(roomRef);
    off(offerRef);
    off(answerRef);
    off(initiatorCandidatesRef);
    off(receiverCandidatesRef);
  };

  const getMedia = async () => {
    try {
      setErrorMsg("");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      localVideoRef.current.srcObject = stream;
      setIsPermissionGranted(true);

      pcRef.current = new RTCPeerConnection(configuration);

      // Add local tracks to peer connection
      stream.getTracks().forEach((track) => {
        pcRef.current.addTrack(track, stream);
      });

      // When remote tracks arrive, set them to remote video element
      pcRef.current.ontrack = (event) => {
        if (remoteVideoRef.current.srcObject !== event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // ICE candidate handler
      pcRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          // Determine role once by reading offer once
          onValue(
            offerRef,
            (snapshot) => {
              const offerExists = snapshot.exists();
              if (!offerExists) {
                // No offer: we are initiator
                const newCandidateRef = push(initiatorCandidatesRef);
                set(newCandidateRef, event.candidate.toJSON());
              } else {
                // Offer exists: we are receiver
                const newCandidateRef = push(receiverCandidatesRef);
                set(newCandidateRef, event.candidate.toJSON());
              }
            },
            { onlyOnce: true }
          );
        }
      };

      // Listen for room data changes (offer/answer)
      onValue(roomRef, async (snapshot) => {
        const roomData = snapshot.val();
        if (!roomData) return;

        if (!roomData.offer && !roomData.answer) {
          // Initiator creates offer
          if (!pcRef.current.localDescription) {
            const offer = await pcRef.current.createOffer();
            await pcRef.current.setLocalDescription(offer);
            await set(offerRef, offer.toJSON());
          }
        }

        if (roomData.offer && !roomData.answer) {
          // Receiver flow: set remote offer and create answer
          if (!pcRef.current.currentRemoteDescription) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(roomData.offer));
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);
            await set(answerRef, answer.toJSON());
          }
        }

        if (roomData.answer && pcRef.current.signalingState !== "stable") {
          // Initiator sets remote answer
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(roomData.answer));
        }
      });

      // Listen for ICE candidates from initiator if receiver
      onValue(initiatorCandidatesRef, (snapshot) => {
        const candidates = snapshot.val();
        if (candidates) {
          Object.values(candidates).forEach(async (candidate) => {
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.error("Error adding initiator ICE candidate:", e);
            }
          });
        }
      });

      // Listen for ICE candidates from receiver if initiator
      onValue(receiverCandidatesRef, (snapshot) => {
        const candidates = snapshot.val();
        if (candidates) {
          Object.values(candidates).forEach(async (candidate) => {
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.error("Error adding receiver ICE candidate:", e);
            }
          });
        }
      });

      setIsConnected(true);
    } catch (err) {
      setErrorMsg("Kamera ve mikrofon erişimi reddedildi veya mevcut değil.");
      setIsPermissionGranted(false);
      setIsConnected(false);
    }
  };

  const cleanup = () => {
    // Stop all media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    // Close peer connection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    // Remove Firebase room data and listeners
    remove(roomRef).catch(() => {});
    cleanupFirebaseListeners();

    setIsConnected(false);
    setIsPermissionGranted(false);
    setErrorMsg("");
  };

  useEffect(() => {
    loginAnonymously()
      .then(() => getMedia())
      .catch(() => {
        setErrorMsg("Anonim giriş başarısız oldu.");
        setIsPermissionGranted(false);
      });

    return () => {
      cleanup();
    };
  }, [roomName]);

  return (
    <div className="video-chat-room">
      {!isPermissionGranted && (
        <div className="permission-request">
          <p>{errorMsg || "Kamera ve mikrofon erişimi gerekiyor."}</p>
          <button className="join-button" onClick={getMedia}>
            Kamera ve Mikrofon İzni Ver
          </button>
          <button className="join-button" onClick={() => navigate("/")}>
            Odayı Terk Et
          </button>
        </div>
      )}

      {isPermissionGranted && (
        <>
          <video ref={localVideoRef} autoPlay muted playsInline className="local-video" />
          <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
          <button
            className="join-button"
            onClick={() => {
              cleanup();
              navigate("/");
            }}
          >
            Odayı Terk Et
          </button>
        </>
      )}
    </div>
  );
}
