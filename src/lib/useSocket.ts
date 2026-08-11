"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_PORT = 4001;

// NEXT_PUBLIC_SOCKET_URL is baked in at build time, which works fine for a
// real deployed domain (e.g. Render). But for local/LAN dev, a hardcoded
// "localhost" is only correct on the exact machine running the dev server -
// a phone or other device on the same network has its OWN localhost, so it
// would silently never connect. Derive the address from whatever host the
// browser actually used to load this page instead, unless the env var
// points somewhere that isn't localhost (a real deployment).
function getSocketUrl() {
  const envUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
  const isLocalEnvUrl = !envUrl || envUrl.includes("localhost") || envUrl.includes("127.0.0.1");
  if (envUrl && !isLocalEnvUrl) return envUrl;
  return `${window.location.protocol}//${window.location.hostname}:${SOCKET_PORT}`;
}

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

      const url = getSocketUrl();
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
