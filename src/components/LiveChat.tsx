"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

type LiveMessage = {
  id: string;
  text: string;
  createdAt: string;
  author: { id: string; username: string };
  likeCount: number;
};

export default function LiveChat({
  socket,
  roomId,
  currentUserId,
}: {
  socket: Socket | null;
  roomId: string;
  currentUserId: string;
}) {
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) return;

    const onMessage = (msg: LiveMessage) => {
      setMessages((prev) => [...prev.slice(-99), msg]);
    };
    const onLiked = ({ messageId, likeCount }: { messageId: string; likeCount: number }) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, likeCount } : m)));
    };

    socket.on("chat-message", onMessage);
    socket.on("message-liked", onLiked);
    return () => {
      socket.off("chat-message", onMessage);
      socket.off("message-liked", onLiked);
    };
  }, [socket]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !socket) return;
    socket.emit("chat-message", { roomId, text: text.trim() });
    setText("");
  }

  function toggleLike(messageId: string) {
    if (!socket) return;
    socket.emit("like-message", { roomId, messageId });
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
        {messages.map((m) => (
          <div key={m.id} className="flex items-start gap-2 text-sm">
            <div
              className={`min-w-0 flex-1 rounded-xl px-3 py-1.5 text-white ${
                m.author.id === currentUserId ? "bg-accent/40" : "bg-black/30"
              }`}
            >
              <span className="font-semibold">{m.author.username}</span>{" "}
              <span className="break-words">{m.text}</span>
            </div>
            <button
              onClick={() => toggleLike(m.id)}
              className="flex flex-col items-center text-white/90"
            >
              <span className={likedIds.has(m.id) ? "" : "opacity-70"}>
                {likedIds.has(m.id) ? "❤️" : "🤍"}
              </span>
              {m.likeCount > 0 && <span className="text-[10px]">{m.likeCount}</span>}
            </button>
          </div>
        ))}
        {messages.length === 0 && (
          <p className="text-center text-xs text-white/60">אין עדיין הודעות בצ&apos;אט</p>
        )}
      </div>

      <form onSubmit={send} className="flex gap-2 p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="כתוב הודעה..."
          className="flex-1 rounded-full border border-white/20 bg-black/40 px-4 py-2 text-sm text-white outline-none placeholder:text-white/50 focus:border-accent"
        />
        <button
          type="submit"
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          שלח
        </button>
      </form>
    </div>
  );
}
