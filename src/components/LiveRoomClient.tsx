"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/lib/useSocket";
import LiveChat from "@/components/LiveChat";
import FloatingHearts, { type FloatingHeartsHandle } from "@/components/FloatingHearts";
import FlvPlayer from "@/components/FlvPlayer";

// STUN alone only works when both sides can be reached directly (or via a
// NAT that's easy to traverse). Strangers on the public internet - mobile
// data, corporate networks, symmetric NAT - often can't establish a direct
// P2P path at all, so the stream silently never arrives. A TURN relay is the
// fallback for exactly that case. This is openrelay.metered.ca's free public
// TURN server (no signup needed) - fine for a hobby project's traffic level.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

type Props = {
  roomId: string;
  isHost: boolean;
  title: string;
  hostUsername: string;
  currentUserId: string;
  currentUsername: string;
  alreadyEnded: boolean;
  broadcastMode: "webrtc" | "rtmp";
  streamKey?: string;
};

function getRtmpServerUrl() {
  if (typeof window === "undefined") return "rtmp://localhost:1935/live";
  const envUrl = process.env.NEXT_PUBLIC_RTMP_URL;
  if (envUrl && !envUrl.includes("localhost")) return envUrl;
  return `rtmp://${window.location.hostname}:1935/live`;
}

export default function LiveRoomClient({
  roomId,
  isHost,
  title,
  hostUsername,
  currentUserId,
  alreadyEnded,
  broadcastMode,
  streamKey,
}: Props) {
  const router = useRouter();
  const { socket, connected } = useSocket();
  const isRtmp = broadcastMode === "rtmp";
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const heartsRef = useRef<FloatingHeartsHandle>(null);

  const [viewerCount, setViewerCount] = useState(0);
  const [ended, setEnded] = useState(alreadyEnded);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  const [sourceMode, setSourceMode] = useState<"camera" | "screen">("camera");
  const [screenShareError, setScreenShareError] = useState<string | null>(null);

  // Host: viewers available to invite to speak, and guests currently on mic.
  const [viewers, setViewers] = useState<{ socketId: string; username: string }[]>([]);
  const [guests, setGuests] = useState<{ socketId: string; username: string }[]>([]);
  const [showViewerList, setShowViewerList] = useState(false);

  // Viewer: an incoming invite from the host, or this viewer's own speaking state.
  const [speakInvite, setSpeakInvite] = useState<{ from: string } | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);

  // The mic/camera stream (audio always comes from here). Video track sent
  // to viewers can be either this stream's camera track, or a screen-share
  // track - swapped in-place with replaceTrack() so peer connections don't
  // need to renegotiate.
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const currentVideoTrackRef = useRef<MediaStreamTrack | null>(null);

  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const viewerPcRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  // Host: audio mixer so a connected guest's mic and the host's own mic both
  // reach every viewer over the existing peer connections (no renegotiation
  // needed - just swap in the mixed track with replaceTrack).
  const guestPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const guestAudioSourcesRef = useRef<Map<string, MediaStreamAudioSourceNode>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const mixedAudioTrackRef = useRef<MediaStreamTrack | null>(null);

  // Viewer (as guest): the mic-only connection back to the host.
  const guestPcRef = useRef<RTCPeerConnection | null>(null);
  const guestStreamRef = useRef<MediaStream | null>(null);
  const hostSocketIdRef = useRef<string | null>(null);

  const cleanupPeers = useCallback(() => {
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    if (viewerPcRef.current) {
      viewerPcRef.current.close();
      viewerPcRef.current = null;
    }
    guestPeersRef.current.forEach((pc) => pc.close());
    guestPeersRef.current.clear();
    guestAudioSourcesRef.current.clear();
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    audioDestRef.current = null;
    mixedAudioTrackRef.current = null;
    guestPcRef.current?.close();
    guestPcRef.current = null;
    guestStreamRef.current?.getTracks().forEach((t) => t.stop());
    guestStreamRef.current = null;
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    currentVideoTrackRef.current = null;
  }, []);

  // Host: lazily builds (once) an audio graph mixing the host's own mic with
  // any connected guests' mics, and swaps the mixed track into every current
  // viewer connection. Later guest audio just connects into the same graph.
  const ensureAudioMixer = useCallback(() => {
    if (audioDestRef.current) return audioDestRef.current;
    const ctx = audioCtxRef.current ?? new AudioContext();
    audioCtxRef.current = ctx;
    const dest = ctx.createMediaStreamDestination();
    const micTrack = cameraStreamRef.current?.getAudioTracks()[0];
    if (micTrack) {
      ctx.createMediaStreamSource(new MediaStream([micTrack])).connect(dest);
    }
    audioDestRef.current = dest;
    const mixedTrack = dest.stream.getAudioTracks()[0] ?? null;
    mixedAudioTrackRef.current = mixedTrack;
    if (mixedTrack) {
      peersRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
        sender?.replaceTrack(mixedTrack).catch(() => {});
      });
    }
    return dest;
  }, []);

  // Host: join the room as soon as we're connected (chat/reactions/viewer-count
  // shouldn't depend on the camera working).
  useEffect(() => {
    if (!isHost || !socket || !connected || ended) return;
    socket.emit("join-room", { roomId, asHost: true });
  }, [isHost, socket, connected, ended, roomId]);

  // Host: separately try to get camera/mic for broadcasting video. If this
  // fails, the host still has chat/reactions, just no outgoing video.
  // Not used in RTMP mode - the video comes from OBS/streaming software instead.
  useEffect(() => {
    if (!isHost || !connected || ended || isRtmp) return;

    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        cameraStreamRef.current = stream;
        currentVideoTrackRef.current = stream.getVideoTracks()[0] ?? null;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch (err) {
        const name = err instanceof Error ? err.name : "";
        const reasons: Record<string, string> = {
          NotAllowedError: "הגישה נחסמה. לחץ על סמל 🔒 ליד כתובת האתר ← מצלמה/מיקרופון ← אפשר, ורענן את הדף.",
          NotFoundError: "לא נמצאה מצלמה או מיקרופון במכשיר הזה.",
          NotReadableError: "המצלמה/מיקרופון בשימוש על ידי אפליקציה אחרת. סגור אותה ונסה שוב.",
          OverconstrainedError: "לא נמצאה מצלמה שתומכת בהגדרות המבוקשות.",
        };
        const reason = reasons[name] ?? "לא ניתן לגשת למצלמה/מיקרופון.";
        setMediaError(`${reason} הצ'אט עדיין פעיל, אך לא תהיה שידור וידאו.`);
      }
    }
    start();

    return () => {
      cancelled = true;
    };
  }, [isHost, connected, ended, isRtmp]);

  // Host: closes a connected guest's mic connection and takes them out of the
  // audio mix. Used both when the host removes a guest and when a guest
  // leaves/disconnects on their own.
  const removeGuest = useCallback((guestId: string) => {
    guestPeersRef.current.get(guestId)?.close();
    guestPeersRef.current.delete(guestId);
    guestAudioSourcesRef.current.get(guestId)?.disconnect();
    guestAudioSourcesRef.current.delete(guestId);
    setGuests((g) => {
      const removed = g.find((x) => x.socketId === guestId);
      if (removed) socket?.emit("speaker-status", { roomId, username: removed.username, active: false });
      return g.filter((x) => x.socketId !== guestId);
    });
  }, [socket, roomId]);

  // Host: handle signaling with each viewer (WebRTC mode only)
  useEffect(() => {
    if (!isHost || !socket || isRtmp) return;

    const onViewerJoined = async ({ socketId, username }: { socketId: string; username: string }) => {
      setViewers((v) => (v.some((x) => x.socketId === socketId) ? v : [...v, { socketId, username }]));

      const camStream = cameraStreamRef.current;
      if (!camStream) return;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      const audioTrack = mixedAudioTrackRef.current ?? camStream.getAudioTracks()[0];
      if (audioTrack) pc.addTrack(audioTrack, camStream);
      const videoTrack = currentVideoTrackRef.current;
      if (videoTrack) pc.addTrack(videoTrack, camStream);

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
      setViewers((v) => v.filter((x) => x.socketId !== socketId));
      removeGuest(socketId);
    };

    const onViewerCount = ({ count }: { count: number }) => setViewerCount(count);

    // Guest (co-host) signaling: a viewer who accepted an invite opens a
    // second, mic-only connection here.
    const onGuestOffer = async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      guestPeersRef.current.set(from, pc);

      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit("guest-ice-candidate", { to: from, candidate: e.candidate });
      };
      pc.ontrack = (e) => {
        const dest = ensureAudioMixer();
        const source = audioCtxRef.current!.createMediaStreamSource(e.streams[0]);
        source.connect(dest);
        guestAudioSourcesRef.current.set(from, source);
      };

      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("guest-answer", { to: from, sdp: answer });

      setGuests((g) => {
        if (g.some((x) => x.socketId === from)) return g;
        const username = viewers.find((v) => v.socketId === from)?.username ?? "אורח";
        socket.emit("speaker-status", { roomId, username, active: true });
        return [...g, { socketId: from, username }];
      });
    };

    const onGuestIceCandidate = async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      await guestPeersRef.current.get(from)?.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    };

    const onGuestLeft = ({ from }: { from: string }) => removeGuest(from);

    socket.on("viewer-joined", onViewerJoined);
    socket.on("webrtc-answer", onAnswer);
    socket.on("webrtc-ice-candidate", onIceCandidate);
    socket.on("viewer-left", onViewerLeft);
    socket.on("viewer-count", onViewerCount);
    socket.on("guest-offer", onGuestOffer);
    socket.on("guest-ice-candidate", onGuestIceCandidate);
    socket.on("guest-left", onGuestLeft);

    return () => {
      socket.off("viewer-joined", onViewerJoined);
      socket.off("webrtc-answer", onAnswer);
      socket.off("webrtc-ice-candidate", onIceCandidate);
      socket.off("viewer-left", onViewerLeft);
      socket.off("viewer-count", onViewerCount);
      socket.off("guest-offer", onGuestOffer);
      socket.off("guest-ice-candidate", onGuestIceCandidate);
      socket.off("guest-left", onGuestLeft);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, socket, isRtmp, removeGuest, ensureAudioMixer, roomId]);

  // Viewer: join room for chat/reactions/viewer-count in every mode; the
  // WebRTC offer/answer dance below only applies to WebRTC-mode broadcasts.
  useEffect(() => {
    if (isHost || !socket || !connected || ended || isRtmp) return;

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
      hostSocketIdRef.current = from;
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

    // Guest (co-host) flow: an invite from the host, and the host answering
    // back once we've offered our mic.
    const onSpeakInvite = ({ from }: { from: string }) => setSpeakInvite({ from });

    const onGuestAnswer = async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
      await guestPcRef.current?.setRemoteDescription(new RTCSessionDescription(sdp));
    };

    const onGuestIceCandidate = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      await guestPcRef.current?.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    };

    const onGuestKicked = () => {
      guestPcRef.current?.close();
      guestPcRef.current = null;
      guestStreamRef.current?.getTracks().forEach((t) => t.stop());
      guestStreamRef.current = null;
      setIsSpeaking(false);
    };

    const onSpeakerStatus = ({ username, active }: { username: string; active: boolean }) => {
      setActiveSpeaker(active ? username : null);
    };

    socket.on("webrtc-offer", onOffer);
    socket.on("webrtc-ice-candidate", onIceCandidate);
    socket.on("viewer-count", onViewerCount);
    socket.on("live-ended", onLiveEnded);
    socket.on("speak-invite", onSpeakInvite);
    socket.on("guest-answer", onGuestAnswer);
    socket.on("guest-ice-candidate", onGuestIceCandidate);
    socket.on("guest-kicked", onGuestKicked);
    socket.on("speaker-status", onSpeakerStatus);

    return () => {
      socket.off("webrtc-offer", onOffer);
      socket.off("webrtc-ice-candidate", onIceCandidate);
      socket.off("viewer-count", onViewerCount);
      socket.off("live-ended", onLiveEnded);
      socket.off("speak-invite", onSpeakInvite);
      socket.off("guest-answer", onGuestAnswer);
      socket.off("guest-ice-candidate", onGuestIceCandidate);
      socket.off("guest-kicked", onGuestKicked);
      socket.off("speaker-status", onSpeakerStatus);
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

  // Viewer in RTMP mode: still join the room for chat/reactions/viewer-count,
  // but skip the WebRTC signaling entirely - video comes from the HLS player.
  useEffect(() => {
    if (isHost || !socket || !connected || ended || !isRtmp) return;
    socket.emit("join-room", { roomId, asHost: false });
    const onViewerCount = ({ count }: { count: number }) => setViewerCount(count);
    socket.on("viewer-count", onViewerCount);
    return () => {
      socket.off("viewer-count", onViewerCount);
    };
  }, [isHost, socket, connected, ended, isRtmp, roomId]);

  useEffect(() => cleanupPeers, [cleanupPeers]);

  const revertToCamera = useCallback(() => {
    const camStream = cameraStreamRef.current;
    const camVideoTrack = camStream?.getVideoTracks()[0] ?? null;

    peersRef.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (camVideoTrack) sender?.replaceTrack(camVideoTrack).catch(() => {});
    });

    currentVideoTrackRef.current = camVideoTrack;
    if (localVideoRef.current && camStream) localVideoRef.current.srcObject = camStream;

    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setSourceMode("camera");
  }, []);

  async function shareScreen() {
    setScreenShareError(null);

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setScreenShareError(
        "שיתוף מסך לא נתמך כאן - נדרש חיבור מאובטח (HTTPS), או גישה דרך localhost באותו מחשב."
      );
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      screenStreamRef.current = screenStream;

      peersRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        sender?.replaceTrack(screenTrack).catch(() => {});
      });

      currentVideoTrackRef.current = screenTrack;
      if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
      setSourceMode("screen");

      // Fires when the user clicks the browser's native "Stop sharing" bar.
      screenTrack.onended = () => revertToCamera();
    } catch (err) {
      // NotAllowedError covers both "permission denied" and "user cancelled
      // the picker" - only surface a message if it's something else, so we
      // don't nag on a plain cancel.
      const name = err instanceof Error ? err.name : "";
      if (name !== "NotAllowedError") {
        setScreenShareError("לא ניתן היה לשתף את המסך. נסה שוב.");
      }
    }
  }

  function toggleScreenShare() {
    if (sourceMode === "screen") revertToCamera();
    else shareScreen();
  }

  // Host: invite a specific viewer to speak (co-host mic).
  function inviteToSpeak(viewerId: string) {
    socket?.emit("invite-speak", { to: viewerId });
  }

  // Viewer: accept an invite - grab the mic and open a second, audio-only
  // connection to the host carrying just that track.
  async function acceptSpeak() {
    if (!speakInvite || !socket) return;
    const hostId = speakInvite.from;
    setSpeakInvite(null);
    socket.emit("speak-response", { to: hostId, accepted: true });

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      guestStreamRef.current = micStream;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      guestPcRef.current = pc;
      micStream.getTracks().forEach((t) => pc.addTrack(t, micStream));
      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit("guest-ice-candidate", { to: hostId, candidate: e.candidate });
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("guest-offer", { to: hostId, sdp: offer });
      setIsSpeaking(true);
    } catch {
      setMicError("לא ניתן לגשת למיקרופון. אפשר גישה ונסה שוב.");
    }
  }

  function declineSpeak() {
    if (!speakInvite || !socket) return;
    socket.emit("speak-response", { to: speakInvite.from, accepted: false });
    setSpeakInvite(null);
  }

  function leaveSpeak() {
    guestPcRef.current?.close();
    guestPcRef.current = null;
    guestStreamRef.current?.getTracks().forEach((t) => t.stop());
    guestStreamRef.current = null;
    setIsSpeaking(false);
    if (hostSocketIdRef.current) socket?.emit("guest-left", { to: hostSocketIdRef.current });
  }

  // Host: removes a guest and tells their client to hang up too.
  function kickGuest(guestId: string) {
    removeGuest(guestId);
    socket?.emit("guest-kicked", { to: guestId });
  }

  // Keeps the stream floating on top of everything else (other apps, a
  // full-screen game, etc.) once the user leaves this tab.
  async function togglePiP() {
    const video = isHost ? localVideoRef.current : remoteVideoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      // Not supported in this browser, or the video has no track yet.
    }
  }

  function endLive() {
    if (!socket) {
      cleanupPeers();
      router.push("/live");
      return;
    }
    // Wait for the server to confirm before navigating away (which
    // disconnects this socket) - otherwise the "end-live" message can be
    // lost in the disconnect race and the room lingers as still-live.
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      cleanupPeers();
      router.push("/live");
    };
    socket.emit("end-live", { roomId }, finish);
    setTimeout(finish, 2000);
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
        {isRtmp ? (
          isHost ? (
            <div className="flex h-full w-full items-center justify-center bg-black p-6">
              <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-5 text-white">
                <p className="mb-3 text-lg font-semibold">🎬 שידור מ-OBS / תוכנת סטרימינג</p>
                <p className="mb-4 text-sm text-white/70">
                  פתח את OBS (או כל תוכנת שידור אחרת שתומכת ב-RTMP) והזן את הפרטים הבאים,
                  ואז לחץ &quot;Start Streaming&quot;.
                </p>
                <label className="mb-1 block text-xs text-white/60">כתובת שרת (Server)</label>
                <input
                  readOnly
                  value={getRtmpServerUrl()}
                  onFocus={(e) => e.currentTarget.select()}
                  className="mb-3 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm"
                />
                <label className="mb-1 block text-xs text-white/60">מפתח שידור (Stream Key)</label>
                <input
                  readOnly
                  value={streamKey ?? ""}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm"
                />
                <p className="mt-3 text-xs text-accent">
                  אל תשתף את מפתח השידור עם אף אחד - מי שמחזיק בו יכול לשדר בשמך.
                </p>
              </div>
            </div>
          ) : (
            <FlvPlayer
              src={`/api/live/${roomId}/flv`}
              className="h-full w-full object-cover"
              onPlaying={() => setHasRemoteStream(true)}
            />
          )
        ) : isHost ? (
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
            {sourceMode === "screen" && <span className="text-sm text-accent-2">🖥️ מסך</span>}
          </div>
          <div className="flex items-center gap-2">
            {!isRtmp && (
              <button
                onClick={togglePiP}
                title="חלון צף (Picture-in-Picture)"
                className="rounded-full bg-black/40 px-3 py-1.5 text-sm text-white hover:bg-black/60"
              >
                🗔 חלון צף
              </button>
            )}
            {isHost && !isRtmp && (
              <button
                onClick={() => setShowViewerList((v) => !v)}
                className="rounded-full bg-black/40 px-3 py-1.5 text-sm text-white hover:bg-black/60"
              >
                🎙️ הזמן לדבר
              </button>
            )}
            <div className="rounded-full bg-black/40 px-3 py-1.5 text-sm text-white">
              👁️ {viewerCount}
            </div>
          </div>
        </div>

        {isHost && !isRtmp && showViewerList && (
          <div className="absolute left-4 top-16 z-10 max-h-72 w-64 overflow-y-auto rounded-xl border border-white/10 bg-black/80 p-3 text-white backdrop-blur">
            {guests.length > 0 && (
              <>
                <p className="mb-1 text-xs font-semibold text-white/60">מדברים עכשיו</p>
                {guests.map((g) => (
                  <div key={g.socketId} className="mb-2 flex items-center justify-between gap-2 text-sm">
                    <span>🎙️ {g.username}</span>
                    <button
                      onClick={() => kickGuest(g.socketId)}
                      className="rounded-full bg-accent/80 px-2 py-1 text-xs"
                    >
                      הסר
                    </button>
                  </div>
                ))}
                <div className="my-2 border-t border-white/10" />
              </>
            )}
            <p className="mb-1 text-xs font-semibold text-white/60">צופים</p>
            {viewers.length === 0 && <p className="text-xs text-white/50">אין עדיין צופים</p>}
            {viewers
              .filter((v) => !guests.some((g) => g.socketId === v.socketId))
              .map((v) => (
                <div key={v.socketId} className="mb-2 flex items-center justify-between gap-2 text-sm">
                  <span>{v.username}</span>
                  <button
                    onClick={() => inviteToSpeak(v.socketId)}
                    className="rounded-full bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
                  >
                    הזמן לדבר
                  </button>
                </div>
              ))}
          </div>
        )}

        {!isHost && activeSpeaker && (
          <div className="absolute right-4 top-16 rounded-full bg-black/50 px-3 py-1.5 text-xs text-white">
            🎙️ {activeSpeaker} מדבר/ת
          </div>
        )}

        {!isHost && speakInvite && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 px-6">
            <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-card p-5 text-center">
              <p className="mb-4 text-sm font-semibold">
                {hostUsername} הזמין אותך לדבר בלייב! להצטרף?
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={acceptSpeak}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
                >
                  🎙️ להצטרף
                </button>
                <button
                  onClick={declineSpeak}
                  className="rounded-lg bg-black/10 px-4 py-2 text-sm font-semibold"
                >
                  לא תודה
                </button>
              </div>
            </div>
          </div>
        )}

        {!isHost && isSpeaking && (
          <div className="absolute bottom-24 right-4 flex flex-col items-end gap-2 md:bottom-4">
            <span className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white">
              🎙️ אתה מדבר עכשיו
            </span>
            <button
              onClick={leaveSpeak}
              className="rounded-full bg-black/50 px-3 py-1.5 text-xs text-white hover:bg-black/70"
            >
              עזוב את השיחה
            </button>
          </div>
        )}

        {!isHost && micError && (
          <p className="absolute bottom-24 right-4 max-w-xs rounded-lg bg-black/70 px-3 py-1.5 text-xs text-accent md:bottom-4">
            {micError}
          </p>
        )}

        <div className="absolute bottom-24 left-4 flex flex-col gap-3 md:hidden">
          <button
            onClick={react}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-2xl text-white"
          >
            ❤️
          </button>
        </div>

        {isHost && (
          <div className="absolute bottom-4 left-4 flex flex-col items-start gap-2">
            {screenShareError && (
              <p className="max-w-xs rounded-lg bg-black/70 px-3 py-1.5 text-xs text-accent">
                {screenShareError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={endLive}
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white"
              >
                סיים לייב
              </button>
              {!isRtmp && (
                <button
                  onClick={toggleScreenShare}
                  className="rounded-full bg-black/50 px-4 py-2 text-sm font-semibold text-white hover:bg-black/70"
                >
                  {sourceMode === "screen" ? "📷 חזרה למצלמה" : "🖥️ שתף מסך"}
                </button>
              )}
            </div>
          </div>
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
