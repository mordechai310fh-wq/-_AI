"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/lib/useSocket";
import LiveChat from "@/components/LiveChat";
import FloatingHearts, { type FloatingHeartsHandle } from "@/components/FloatingHearts";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

type Props = {
  roomId: string;
  isHost: boolean;
  title: string;
  hostUsername: string;
  currentUserId: string;
  currentUsername: string;
  alreadyEnded: boolean;
};

export default function LiveRoomClient({
  roomId,
  isHost,
  title,
  hostUsername,
  currentUserId,
  alreadyEnded,
}: Props) {
  const router = useRouter();
  const { socket, connected } = useSocket();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const heartsRef = useRef<FloatingHeartsHandle>(null);

  const [viewerCount, setViewerCount] = useState(0);
  const [ended, setEnded] = useState(alreadyEnded);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [hasRemoteStream, setHasRemoteStream] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const viewerPcRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const cleanupPeers = useCallback(() => {
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    if (viewerPcRef.current) {
      viewerPcRef.current.close();
      viewerPcRef.current = null;
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
  }, []);

  // Host: join the room as soon as we're connected (chat/reactions/viewer-count
  // shouldn't depend on the camera working).
  useEffect(() => {
    if (!isHost || !socket || !connected || ended) return;
    socket.emit("join-room", { roomId, asHost: true });
  }, [isHost, socket, connected, ended, roomId]);

  // Host: separately try to get camera/mic for broadcasting video. If this
  // fails, the host still has chat/reactions, just no outgoing video.
  useEffect(() => {
    if (!isHost || !connected || ended) return;

    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch {
        setMediaError("לא ניתן לגשת למצלמה/מיקרופון. הצ'אט עדיין פעיל, אך לא תהיה שידור וידאו.");
      }
    }
    start();

    return () => {
      cancelled = true;
    };
  }, [isHost, connected, ended]);

  // Host: handle signaling with each viewer
  useEffect(() => {
    if (!isHost || !socket) return;

    const onViewerJoined = async ({ socketId }: { socketId: string }) => {
      const stream = localStreamRef.current;
      if (!stream) return;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit("webrtc-ice-candidate", { to: socketId, candidate: e.candidate });
        }
      };
      peersRef.current.set(socketId, pc);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("webrtc-offer", { to: socketId, sdp: offer });
    };

    const onAnswer = async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      const pc = peersRef.current.get(from);
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    };

    const onIceCandidate = async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      const pc = peersRef.current.get(from);
      if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    };

    const onViewerLeft = ({ socketId }: { socketId: string }) => {
      peersRef.current.get(socketId)?.close();
      peersRef.current.delete(socketId);
    };

    const onViewerCount = ({ count }: { count: number }) => setViewerCount(count);

    socket.on("viewer-joined", onViewerJoined);
    socket.on("webrtc-answer", onAnswer);
    socket.on("webrtc-ice-candidate", onIceCandidate);
    socket.on("viewer-left", onViewerLeft);
    socket.on("viewer-count", onViewerCount);

    return () => {
      socket.off("viewer-joined", onViewerJoined);
      socket.off("webrtc-answer", onAnswer);
      socket.off("webrtc-ice-candidate", onIceCandidate);
      socket.off("viewer-left", onViewerLeft);
      socket.off("viewer-count", onViewerCount);
    };
  }, [isHost, socket]);

  // Viewer: join room and handle host's offer
  useEffect(() => {
    if (isHost || !socket || !connected || ended) return;

    socket.emit("join-room", { roomId, asHost: false });

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    viewerPcRef.current = pc;

    pc.ontrack = (e) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
      setHasRemoteStream(true);
    };

    let hostSocketId: string | null = null;

    pc.onicecandidate = (e) => {
      if (e.candidate && hostSocketId) {
        socket.emit("webrtc-ice-candidate", { to: hostSocketId, candidate: e.candidate });
      }
    };

    const onOffer = async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      hostSocketId = from;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      for (const c of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
      pendingCandidatesRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc-answer", { to: from, sdp: answer });
    };

    const onIceCandidate = async ({ candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      if (pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    };

    const onViewerCount = ({ count }: { count: number }) => setViewerCount(count);
    const onLiveEnded = () => setEnded(true);

    socket.on("webrtc-offer", onOffer);
    socket.on("webrtc-ice-candidate", onIceCandidate);
    socket.on("viewer-count", onViewerCount);
    socket.on("live-ended", onLiveEnded);

    return () => {
      socket.off("webrtc-offer", onOffer);
      socket.off("webrtc-ice-candidate", onIceCandidate);
      socket.off("viewer-count", onViewerCount);
      socket.off("live-ended", onLiveEnded);
      pc.close();
      viewerPcRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, socket, connected, ended]);

  useEffect(() => {
    if (!socket) return;
    const onLiveEnded = () => setEnded(true);
    socket.on("live-ended", onLiveEnded);
    return () => {
      socket.off("live-ended", onLiveEnded);
    };
  }, [socket]);

  useEffect(() => cleanupPeers, [cleanupPeers]);

  function endLive() {
    socket?.emit("end-live", { roomId });
    cleanupPeers();
    router.push("/live");
  }

  function react() {
    heartsRef.current?.spawnLocal();
    socket?.emit("reaction", { roomId });
  }

  if (ended) {
    return (
      <div className="flex h-[calc(100dvh-64px)] flex-col items-center justify-center gap-3 text-center">
        <p className="text-2xl">📴</p>
        <p className="text-lg font-semibold">הלייב הסתיים</p>
        <button
          onClick={() => router.push("/live")}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          חזרה ללייבים
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex h-[calc(100dvh-64px)] w-full flex-col bg-black md:flex-row">
      <div className="relative flex-1 overflow-hidden">
        {isHost ? (
          <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        ) : (
          <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
        )}

        {!isHost && !hasRemoteStream && (
          <div className="absolute inset-0 flex items-center justify-center text-white/70">
            ממתין לשידור של {hostUsername}...
          </div>
        )}

        {mediaError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 px-6 text-center text-accent">
            {mediaError}
          </div>
        )}

        <FloatingHearts ref={heartsRef} socket={socket} />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <div className="flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            <span className="text-sm font-semibold">LIVE</span>
            <span className="text-sm text-white/80">· {title}</span>
          </div>
          <div className="rounded-full bg-black/40 px-3 py-1.5 text-sm text-white">
            👁️ {viewerCount}
          </div>
        </div>

        <div className="absolute bottom-24 left-4 flex flex-col gap-3 md:hidden">
          <button
            onClick={react}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-2xl text-white"
          >
            ❤️
          </button>
        </div>

        {isHost && (
          <button
            onClick={endLive}
            className="absolute bottom-4 left-4 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            סיים לייב
          </button>
        )}
      </div>

      <div className="relative flex h-64 w-full flex-col border-t border-white/10 md:h-auto md:w-80 md:border-t-0 md:border-r">
        <div className="hidden justify-end p-3 md:flex">
          <button
            onClick={react}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
            title="שלח לב"
          >
            ❤️
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <LiveChat socket={socket} roomId={roomId} currentUserId={currentUserId} />
        </div>
      </div>
    </div>
  );
}
