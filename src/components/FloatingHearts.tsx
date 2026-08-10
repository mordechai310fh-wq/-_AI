"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { Socket } from "socket.io-client";

type Heart = { id: number; left: number };

export type FloatingHeartsHandle = { spawnLocal: () => void };

const FloatingHearts = forwardRef<FloatingHeartsHandle, { socket: Socket | null }>(
  function FloatingHearts({ socket }, ref) {
    const [hearts, setHearts] = useState<Heart[]>([]);

    function spawn() {
      const id = Date.now() + Math.random();
      setHearts((prev) => [...prev, { id, left: 20 + Math.random() * 60 }]);
      setTimeout(() => {
        setHearts((prev) => prev.filter((h) => h.id !== id));
      }, 1800);
    }

    useImperativeHandle(ref, () => ({ spawnLocal: spawn }));

    useEffect(() => {
      if (!socket) return;
      const onReaction = () => spawn();
      socket.on("reaction", onReaction);
      return () => {
        socket.off("reaction", onReaction);
      };
    }, [socket]);

    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {hearts.map((h) => (
          <span
            key={h.id}
            className="float-heart absolute bottom-24 text-3xl"
            style={{ left: `${h.left}%` }}
          >
            ❤️
          </span>
        ))}
      </div>
    );
  }
);

export default FloatingHearts;
