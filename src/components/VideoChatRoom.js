import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ref, onValue, set, remove } from "firebase/database";
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
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Firebase signaling references
  const roomRef = ref(db, `rooms/${roomName}`);
  const offerRef = ref(db, `rooms/${roomName}/offer`);
  const answerRef = ref(db, `rooms/${roomName}/answer`);
  const candidatesRef = ref(db, `rooms/${roomName}/candidates`);

  // Request media permissions and start stream
  const getMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideoRef.current.srcObject = stream;
      setIsPermissionGranted(true);

      pcRef.current = new RTCPeerConnection(configuration);

      // Add local tracks to peer connection
      stream.getTracks().forEach((track) => {
        pcRef.current.addTrack(track, stream);
      });

      // When remote stream arrives, show it
      pcRef.current.ontrack = (event) => {
        if (remoteVideoRef.current.srcObject !== event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // ICE candidates collection and sending to Firebase
      pcRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          const newCandidateRef = ref(db, `rooms/${roomName}/candidates/${Date.now()}`);
          set(newCandidateRef, event.candidate.toJSON());
        }
      };

      // Signaling logic
      onValue(roomRef, async (snapshot) => {
        const roomData = snapshot.val();

        // If no offer and no answer, this user is the initiator
        if (!roomData?.offer && !roomData?.answer) {
          // Create offer
          const offer = await pcRef.current.createOffer();
          await pcRef.current.setLocalDescription(offer);
          await set(offerRef, offer.toJSON());
        }

        // If offer exists and no answer, this user is receiver
        if (roomData?.offer && !roomData?.answer) {
          const offerDescription = roomData.offer;
          if (!pcRef.current.currentRemoteDescription) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(offerDescription));
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);
            await set(answerRef, answer.toJSON());
          }
        }

        // If answer exists and remote description not set yet
        if (roomData?.answer && pcRef.current.signalingState !== "stable") {
          const answerDescription = roomData.answer;
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answerDescription));
        }
      });

      // Listen for remote ICE candidates
      onValue(candidatesRef, (snapshot) => {
        const candidates = snapshot.val();
        if (candidates) {
          Object.values(candidates).forEach(async (candidate) => {
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.error("Error adding received ICE candidate", e);
            }
          });
        }
      });
    } catch (err) {
      setErrorMsg("Kamera ve mikrofon erişimi reddedildi veya mevcut değil.");
      setIsPermissionGranted(false);
    }
  };

  // On component mount
  useEffect(() => {
    loginAnonymously();

    // Cleanup on unmount
    return () => {
      if (pcRef.current) {
        pcRef.current.close();
      }
      // Remove room data from Firebase to avoid stale data
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
