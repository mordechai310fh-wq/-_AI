"use client";

import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { useGlobalMute } from "@/lib/useGlobalMute";

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
  const { muted, setMuted } = useGlobalMute();
  // Portrait videos fill the phone-shaped feed nicely with a crop (TikTok's
  // usual look), but a landscape/widescreen source cropped the same way
  // loses most of the frame - scale those down to fit instead of cropping.
  const [videoFit, setVideoFit] = useState<"cover" | "contain">("cover");

  function handleLoadedMetadata() {
    const v = videoRef.current;
    if (!v) return;
    setVideoFit(v.videoWidth > v.videoHeight ? "contain" : "cover");
  }

  const [imageFit, setImageFit] = useState<"cover" | "contain">("cover");

  function handleImageLoad(e: SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    setImageFit(img.naturalWidth > img.naturalHeight ? "contain" : "cover");
  }

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

  // When a video has its own separate sound track attached (TikTok-style
  // "add sound" over video), the video's native audio is silenced and the
  // attached track drives sound instead - play/pause together so they stay
  // roughly in sync.
  const hasSeparateSound = !!videoUrl && !!audioUrl;

  useEffect(() => {
    const media = [videoRef.current, audioRef.current].filter((m): m is HTMLVideoElement | HTMLAudioElement => !!m);
    if (media.length === 0) return;
    if (inView) {
      media.forEach((m) => m.play().catch(() => {}));
    } else {
      media.forEach((m) => m.pause());
    }
  }, [inView]);

  // The `muted` JSX attribute only reliably applies on first mount - some
  // browsers don't pick up later changes made only through the React prop,
  // so toggling mute state alone can silently fail to un-silence media that's
  // already playing. Setting the property imperatively is what actually
  // takes effect.
  useEffect(() => {
    const videoMuted = hasSeparateSound ? true : muted;
    if (videoRef.current) videoRef.current.muted = videoMuted;
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted, hasSeparateSound]);

  function toggleMute() {
    setMuted(!muted);
  }

  const hasSound = !!videoUrl || !!audioUrl;

  return (
    <div ref={containerRef} className="absolute inset-0">
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          muted={hasSeparateSound ? true : muted}
          loop
          playsInline
          onLoadedMetadata={handleLoadedMetadata}
          className={`h-full w-full ${videoFit === "contain" ? "bg-black object-contain" : "object-cover"}`}
        />
      ) : imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          onLoad={handleImageLoad}
          className={`absolute inset-0 h-full w-full ${
            imageFit === "contain" ? "bg-black object-contain" : "object-cover"
          }`}
        />
      ) : null}

      {audioUrl && <audio ref={audioRef} src={audioUrl} muted={muted} loop />}

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
