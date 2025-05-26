import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ref, onValue, set, remove, push, off } from "firebase/database";
import { db, loginAnonymously } from "../firebase/firebase";
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

  // Firebase refs (create inside getMedia to avoid stale refs)
  const [roomRef, setRoomRef] = useState(null);
  const [offerRef, setOfferRef] = useState(null);
  const [answerRef, setAnswerRef] = useState(null);
  const [initiatorCandidatesRef, setInitiatorCandidatesRef] = useState(null);
  const [receiverCandidatesRef, setReceiverCandidatesRef] = useState(null);

  // Cleanup Firebase listeners helper
  const cleanupFirebaseListeners = () => {
    if (roomRef) off(roomRef);
    if (offerRef) off(offerRef);
    if (answerRef) off(answerRef);
    if (initiatorCandidatesRef) off(initiatorCandidatesRef);
    if (receiverCandidatesRef) off(receiverCandidatesRef);
  };

  // Cleanup everything on leaving room
  const cleanup = async () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    // Remove Firebase data only if user is initiator or if you want to clean room
    if (roomRef) {
      try {
        await remove(roomRef);
      } catch {}
    }
    cleanupFirebaseListeners();

    setIsConnected(false);
    setIsPermissionGranted(false);
    setErrorMsg("");
  };

  // Main function: request permissions and setup connection
  const getMedia = async () => {
    setErrorMsg("");
    try {
      // Login anonymously before anything else
      await loginAnonymously();

      // Request camera and mic
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setIsPermissionGranted(true);

      // Setup Firebase refs (useState for fresh refs)
      const rRef = ref(db, `rooms/${roomName}`);
      setRoomRef(rRef);
      setOfferRef(ref(db, `rooms/${roomName}/offer`));
      setAnswerRef(ref(db, `rooms/${roomName}/answer`));
      setInitiatorCandidatesRef(ref(db, `rooms/${roomName}/initiatorCandidates`));
      setReceiverCandidatesRef(ref(db, `rooms/${roomName}/receiverCandidates`));

      // Create PeerConnection
      pcRef.current = new RTCPeerConnection(configuration);

      // Add local tracks
      stream.getTracks().forEach((track) => {
        pcRef.current.addTrack(track, stream);
      });

      // When remote stream arrives
      pcRef.current.ontrack = (event) => {
        if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // ICE candidate event
      pcRef.current.onicecandidate = (event) => {
        if (!event.candidate) return;

        onValue(
          rRef.child("offer"),
          (snapshot) => {
            const offerExists = snapshot.exists();
            if (!offerExists) {
              // We are initiator
              const newCandidateRef = push(ref(db, `rooms/${roomName}/initiatorCandidates`));
              set(newCandidateRef, event.candidate.toJSON());
            } else {
              // We are receiver
              const newCandidateRef = push(ref(db, `rooms/${roomName}/receiverCandidates`));
              set(newCandidateRef, event.candidate.toJSON());
            }
          },
          { onlyOnce: true }
        );
      };

      // Listen for offer & answer changes
      onValue(rRef, async (snapshot) => {
        const roomData = snapshot.val();
        if (!roomData) return;

        // Initiator creates offer if none exists
        if (!roomData.offer && !roomData.answer) {
          if (!pcRef.current.localDescription) {
            const offer = await pcRef.current.createOffer();
            await pcRef.current.setLocalDescription(offer);
            await set(ref(db, `rooms/${roomName}/offer`), offer.toJSON());
          }
        }

        // Receiver sets remote offer and creates answer
        if (roomData.offer && !roomData.answer) {
          if (!pcRef.current.currentRemoteDescription) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(roomData.offer));
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);
            await set(ref(db, `rooms/${roomName}/answer`), answer.toJSON());
          }
        }

        // Initiator sets remote answer
        if (roomData.answer && pcRef.current.signalingState !== "stable") {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(roomData.answer));
        }
      });

      // Listen ICE candidates from initiator (for receiver)
      onValue(ref(db, `rooms/${roomName}/initiatorCandidates`), (snapshot) => {
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

      // Listen ICE candidates from receiver (for initiator)
      onValue(ref(db, `rooms/${roomName}/receiverCandidates`), (snapshot) => {
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

  // Cleanup on unmount or roomName change
  useEffect(() => {
    // On mount, do nothing — wait for user click to get permission
    // But login anonymously here so firebase is ready for login
    loginAnonymously().catch(() => {
      setErrorMsg("Anonim giriş başarısız oldu.");
    });

    return () => {
      cleanup();
    };
  }, [roomName]);

  return (
    <div className="video-chat-room">
      {!isPermissionGranted ? (
        <div className="permission-request">
          <p>{errorMsg || "Kamera ve mikrofon erişimi gerekiyor."}</p>
          <button className="join-button" onClick={getMedia}>
            Kamera ve Mikrofon İzni Ver
          </button>
          <button
            className="join-button"
            onClick={() => {
              cleanup();
              navigate("/");
            }}
          >
            Odayı Terk Et
          </button>
        </div>
      ) : (
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
