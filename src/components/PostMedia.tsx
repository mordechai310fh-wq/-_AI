"use client";

import { useEffect, useRef, useState } from "react";

export default function PostMedia({
  imageUrl,
  videoUrl,
  audioUrl,
}: {
  imageUrl: string | null;
  videoUrl: string | null;
  audioUrl: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [inView, setInView] = useState(false);
  const [muted, setMuted] = useState(true);

  // Only the post currently on screen plays - matches the TikTok feed
  // convention and avoids every post's media playing at once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.6,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const media = videoRef.current ?? audioRef.current;
    if (!media) return;
    if (inView) {
      media.play().catch(() => {});
    } else {
      media.pause();
    }
  }, [inView]);

  function toggleMute() {
    setMuted((m) => !m);
  }

  const hasSound = !!videoUrl || !!audioUrl;

  return (
    <div ref={containerRef} className="absolute inset-0">
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          muted={muted}
          loop
          playsInline
          className="h-full w-full object-cover"
        />
      ) : imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}

      {audioUrl && !videoUrl && <audio ref={audioRef} src={audioUrl} muted={muted} loop />}

      {hasSound && (
        <button
          onClick={toggleMute}
          className="absolute left-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-lg text-white"
          title={muted ? "בטל השתקה" : "השתק"}
        >
          {muted ? "🔇" : "🔊"}
        </button>
      )}
    </div>
  );
}
