"use client";

import { useEffect, useState } from "react";

// Sound should stay on (or off) as you scroll between posts, like TikTok -
// otherwise every post resets to muted on mount and unmuting looks broken
// since you'd have to re-tap it for every single post.
let globalMuted = true;
const listeners = new Set<(muted: boolean) => void>();

export function useGlobalMute() {
  const [muted, setMutedState] = useState(globalMuted);

  useEffect(() => {
    listeners.add(setMutedState);
    return () => {
      listeners.delete(setMutedState);
    };
  }, []);

  function setMuted(next: boolean) {
    globalMuted = next;
    listeners.forEach((listener) => listener(next));
  }

  return { muted, setMuted };
}
