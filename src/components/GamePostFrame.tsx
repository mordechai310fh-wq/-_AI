"use client";

import { useEffect, useRef, useState } from "react";

export default function GamePostFrame({
  code,
  gameType,
  controls,
}: {
  code: string;
  gameType: string | null;
  controls: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [playing, setPlaying] = useState(false);
  const [showControlsHint, setShowControlsHint] = useState(false);

  // Iframes are a separate browsing context: keydown/keyup only reach the
  // game once the iframe itself has focus, otherwise "can't move/shoot".
  useEffect(() => {
    if (!playing) return;
    iframeRef.current?.focus();
    if (!controls) return;
    setShowControlsHint(true);
    const timer = setTimeout(() => setShowControlsHint(false), 3500);
    return () => clearTimeout(timer);
  }, [playing, controls]);

  // Pause (unmount) the game once it's scrolled mostly out of view, so the
  // feed doesn't keep many game loops running at once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) setPlaying(false);
      },
      { threshold: 0.6 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 bg-black">
      {playing ? (
        <>
          <iframe
            ref={iframeRef}
            title="משחק"
            srcDoc={code}
            sandbox="allow-scripts"
            onLoad={() => iframeRef.current?.focus()}
            className="h-full w-full border-0"
          />
          {showControlsHint && controls && (
            <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
              <span className="rounded-full bg-black/70 px-4 py-1.5 text-sm text-white">
                🎮 {controls}
              </span>
            </div>
          )}
        </>
      ) : (
        <button
          onClick={() => setPlaying(true)}
          className="flex h-full w-full flex-col items-center justify-center gap-3 text-white"
        >
          <span className="text-5xl">🎮</span>
          <span className="text-lg font-semibold">▶ הפעל משחק</span>
          {gameType && <span className="text-xs text-white/60">{gameType}</span>}
          {controls && <span className="mt-1 max-w-[80%] text-center text-xs text-white/70">{controls}</span>}
        </button>
      )}
    </div>
  );
}
