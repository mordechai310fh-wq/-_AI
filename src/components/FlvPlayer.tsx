"use client";

import { useEffect, useRef } from "react";
import flvjs from "flv.js";

type Props = {
  src: string;
  className?: string;
  onPlaying?: () => void;
};

export default function FlvPlayer({ src, className, onPlaying }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !flvjs.isSupported()) return;

    const player = flvjs.createPlayer({ type: "flv", url: src, isLive: true });
    player.attachMediaElement(video);
    player.load();
    Promise.resolve(player.play()).catch(() => {});

    const handlePlaying = () => onPlaying?.();
    video.addEventListener("playing", handlePlaying);

    return () => {
      video.removeEventListener("playing", handlePlaying);
      player.pause();
      player.unload();
      player.detachMediaElement();
      player.destroy();
    };
  }, [src, onPlaying]);

  return <video ref={videoRef} autoPlay playsInline controls className={className} />;
}
