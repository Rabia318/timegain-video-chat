import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ref, onValue, set, remove, push } from "firebase/database";
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
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isConnected, setIsConnected] = useState(false);

  // Firebase paths
  const roomRef = ref(db, `rooms/${roomName}`);
  const offerRef = ref(db, `rooms/${roomName}/offer`);
  const answerRef = ref(db, `rooms/${roomName}/answer`);
  const initiatorCandidatesRef = ref(db, `rooms/${roomName}/initiatorCandidates`);
  const receiverCandidatesRef = ref(db, `rooms/${roomName}/receiverCandidates`);

  const getMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideoRef.current.srcObject = stream;
      setIsPermissionGranted(true);

      pcRef.current = new RTCPeerConnection(configuration);

      // Add local stream tracks
      stream.getTracks().forEach((track) => {
        pcRef.current.addTrack(track, stream);
      });

      // When remote tracks arrive
      pcRef.current.ontrack = (event) => {
        if (remoteVideoRef.current.srcObject !== event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // ICE candidate event
      pcRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          // Determine role: initiator or receiver
          onValue(offerRef, (snapshot) => {
            const offerExists = snapshot.exists();
            if (!offerExists) {
              // No offer yet: we are initiator
              const newCandidateRef = push(initiatorCandidatesRef);
              set(newCandidateRef, event.candidate.toJSON());
            } else {
              // Offer exists: we are receiver
              const newCandidateRef = push(receiverCandidatesRef);
              set(newCandidateRef, event.candidate.toJSON());
            }
          }, { onlyOnce: true });
        }
      };

      // Signaling logic
      onValue(roomRef, async (snapshot) => {
        const roomData = snapshot.val();

        if (!roomData?.offer && !roomData?.answer) {
          // Initiator flow: create offer
          const offer = await pcRef.current.createOffer();
          await pcRef.current.setLocalDescription(offer);
          await set(offerRef, offer.toJSON());
        }

        if (roomData?.offer && !roomData?.answer) {
          // Receiver flow: set remote offer and create answer
          if (!pcRef.current.currentRemoteDescription) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(roomData.offer));
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);
            await set(answerRef, answer.toJSON());
          }
        }

        if (roomData?.answer && pcRef.current.signalingState !== "stable") {
          // Initiator sets remote answer
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(roomData.answer));
        }
      });

      // Listen for initiator candidates if receiver
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

      // Listen for receiver candidates if initiator
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

  useEffect(() => {
    // Login anonymously and get media on mount
    loginAnonymously().then(() => {
      getMedia();
    });

    // Cleanup on unmount
    return () => {
      if (pcRef.current) {
        pcRef.current.close();
      }
      // Remove room data to prevent stale signals
      remove(roomRef);
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
          <button className="join-button" onClick={() => navigate("/")}>
            Odayı Terk Et
          </button>
        </>
      )}
    </div>
  );
}
