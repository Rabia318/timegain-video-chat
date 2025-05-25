import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase/firebase";
import { ref, onValue, set, push, onChildAdded, remove } from "firebase/database";

const VideoChatRoom = ({ roomId, userId }) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState("");

  const pc = useRef(null);

  useEffect(() => {
    if (!started) return;

    const servers = {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };

    pc.current = new RTCPeerConnection(servers);

    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        const candidatesRef = ref(db, `rooms/${roomId}/candidates/${userId}`);
        const newCandidateRef = push(candidatesRef);
        set(newCandidateRef, event.candidate.toJSON());
      }
    };

    pc.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        stream.getTracks().forEach((track) => {
          pc.current.addTrack(track, stream);
        });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const signalRef = ref(db, `rooms/${roomId}/signal`);
        onValue(signalRef, async (snapshot) => {
          const data = snapshot.val();
          if (!data) {
            // Bu kullanıcı başlatıcı
            const offer = await pc.current.createOffer();
            await pc.current.setLocalDescription(offer);
            await set(signalRef, { offer });
          } else if (data.offer && !data.answer) {
            // Bu kullanıcı alıcı
            await pc.current.setRemoteDescription(data.offer);
            const answer = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answer);
            await set(signalRef, { ...data, answer });
          } else if (data.answer && !pc.current.currentRemoteDescription) {
            // Başlatıcı cevabı alır
            await pc.current.setRemoteDescription(data.answer);
          }
        });

        const remoteCandidatesRef = ref(db, `rooms/${roomId}/candidates`);
        onChildAdded(remoteCandidatesRef, (snapshot) => {
          const candidate = snapshot.val();
          if (candidate && candidate !== userId) {
            pc.current.addIceCandidate(new RTCIceCandidate(candidate));
          }
        });
      })
      .catch((err) => {
        console.error("Kamera/mikrofon hatası:", err);
        setError("Kamera/mikrofon erişimi reddedildi.");
      });

    return () => {
      remove(ref(db, `rooms/${roomId}/candidates/${userId}`));
      pc.current.close();
    };
  }, [started]);

  return (
    <div className="max-w-4xl mx-auto mt-8 p-6 rounded-lg bg-white shadow-md">
      <h2 className="text-center text-2xl font-semibold mb-4">Oda: {roomId}</h2>

      {!started && (
        <div className="text-center mt-4">
          <button
            onClick={() => {
              setStarted(true);
              setError("");
            }}
            className="px-6 py-2 text-lg bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            Kamerayı Aç ve Bağlan
          </button>
        </div>
      )}

      {error && (
        <p className="text-red-500 text-center mt-4">
          {error}
        </p>
      )}

      {started && (
        <div className="flex flex-col md:flex-row justify-around mt-6 gap-6">
          <div className="text-center">
            <h3 className="mb-2 font-medium">Sen</h3>
            <video
              ref={localVideoRef}
              muted
              autoPlay
              playsInline
              className="w-full md:w-80 rounded-lg bg-black"
            />
          </div>
          <div className="text-center">
            <h3 className="mb-2 font-medium">Karşı Taraf</h3>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full md:w-80 rounded-lg bg-black"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoChatRoom;
