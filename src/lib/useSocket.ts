"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      const res = await fetch("/api/socket-token");
      if (!res.ok) return;
      const { token } = await res.json();
      if (cancelled) return;

      const url = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4001";
      const s = io(url, { auth: { token }, transports: ["websocket", "polling"] });

      s.on("connect", () => {
        setConnected(true);
        setError(null);
      });
      s.on("disconnect", () => setConnected(false));
      s.on("connect_error", (err) => {
        console.error("Socket connection error:", err.message);
        setError(err.message);
      });

      socketRef.current = s;
      setSocket(s);
    }

    connect();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  return { socket, connected, error };
}
