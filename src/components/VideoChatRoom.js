import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { initializeApp } from "firebase/app";
import {
  getDatabase,
  ref,
  onValue,
  set,
  push,
  remove,
} from "firebase/database";

// Firebase configuration - kendi config bilgilerini ekle
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  databaseURL: "YOUR_DB_URL",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_BUCKET",
  messagingSenderId: "YOUR_MSG_SENDER_ID",
  appId: "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const configuration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
  ],
};

const VideoChatRoom = () => {
  const { roomId } = useParams();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const [isInitiator, setIsInitiator] = useState(false);

  useEffect(() => {
    let localStream;

    const start = async () => {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }

        const roomRef = ref(database, `rooms/${roomId}`);

        // Check if signaling data already exists to determine initiator
        onValue(roomRef, (snapshot) => {
          const data = snapshot.val();
          if (!data) {
            setIsInitiator(true);
          } else {
            setIsInitiator(false);
          }
        }, { onlyOnce: true });

        peerConnectionRef.current = new RTCPeerConnection(configuration);

        // Add local tracks
        localStream.getTracks().forEach((track) => {
          peerConnectionRef.current.addTrack(track, localStream);
        });

        // Listen for remote tracks
        peerConnectionRef.current.ontrack = (event) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        // ICE Candidate event
        peerConnectionRef.current.onicecandidate = (event) => {
          if (event.candidate) {
            const candidatesRef = ref(database, `rooms/${roomId}/candidates`);
            push(candidatesRef, event.candidate.toJSON());
          }
        };

        if (isInitiator) {
          // Create offer
          const offer = await peerConnectionRef.current.createOffer();
          await peerConnectionRef.current.setLocalDescription(offer);

          // Save offer to Firebase
          set(ref(database, `rooms/${roomId}/offer`), offer.toJSON());

          // Listen for answer
          onValue(ref(database, `rooms/${roomId}/answer`), async (snapshot) => {
            const answer = snapshot.val();
            if (answer) {
              const rtcAnswer = new RTCSessionDescription(answer);
              await peerConnectionRef.current.setRemoteDescription(rtcAnswer);
            }
          });
        } else {
          // Listen for offer
          onValue(ref(database, `rooms/${roomId}/offer`), async (snapshot) => {
            const offer = snapshot.val();
            if (offer) {
              await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));

              // Create answer
              const answer = await peerConnectionRef.current.createAnswer();
              await peerConnectionRef.current.setLocalDescription(answer);

              // Save answer to Firebase
              set(ref(database, `rooms/${roomId}/answer`), answer.toJSON());
            }
          });

          // Listen for candidates
          const candidatesRef = ref(database, `rooms/${roomId}/candidates`);
          onValue(candidatesRef, (snapshot) => {
            const candidates = snapshot.val();
            if (candidates) {
              Object.values(candidates).forEach(async (candidate) => {
                try {
                  await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) {
                  console.error("Error adding received ICE candidate", err);
                }
              });
            }
          });
        }

        // Listen for candidates and add to peer connection
        const candidatesRef = ref(database, `rooms/${roomId}/candidates`);
        onValue(candidatesRef, (snapshot) => {
          const candidates = snapshot.val();
          if (candidates) {
            Object.values(candidates).forEach(async (candidate) => {
              try {
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (err) {
                console.error("Error adding received ICE candidate", err);
              }
            });
          }
        });
      } catch (err) {
        console.error("Error accessing media devices.", err);
      }
    };

    start();

    // Cleanup on unmount
    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (localVideoRef.current && localVideoRef.current.srcObject) {
        localVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
      // Optionally clear Firebase data here if needed
      remove(ref(database, `rooms/${roomId}`));
    };
  }, [roomId, isInitiator]);

  return (
    <div className="video-chat-room">
      <video className="local-video" ref={localVideoRef} autoPlay playsInline muted />
      <video className="remote-video" ref={remoteVideoRef} autoPlay playsInline />
    </div>
  );
};

export default VideoChatRoom;
