"use client";

import { useEffect, useState } from "react";

type AdminMessage = { id: string; text: string; targetUserId: string | null; createdAt: string };

const POLL_INTERVAL_MS = 15_000;

export default function MessageInbox() {
  const [queue, setQueue] = useState<AdminMessage[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/messages/inbox");
        if (!res.ok) return;
        const data = await res.json();
        const items: AdminMessage[] = data.items ?? [];
        if (!cancelled && items.length > 0) {
          setQueue((prev) => [...prev, ...items]);
        }
      } catch {
        // Network hiccup - just try again on the next interval.
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  function dismiss(message: AdminMessage) {
    setQueue((prev) => prev.filter((m) => m.id !== message.id));
    fetch("/api/messages/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ upTo: message.createdAt }),
    }).catch(() => {});
  }

  // Auto-vanish each toast 2 seconds after it appears.
  useEffect(() => {
    if (queue.length === 0) return;
    const timer = setTimeout(() => dismiss(queue[0]), 2000);
    return () => clearTimeout(timer);
  }, [queue]);

  if (queue.length === 0) return null;

  return (
    <div className="fixed inset-x-0 top-16 z-[60] flex flex-col items-center gap-2 px-4">
      {queue.map((message) => (
        <div
          key={message.id}
          className="inline-flex w-fit max-w-sm items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-lg"
        >
          <span className="text-xl">{message.targetUserId ? "✉️" : "📢"}</span>
          <div>
            <p className="mb-1 text-xs font-semibold text-muted">
              {message.targetUserId ? "הודעה פרטית מהמנהל" : "הודעה כללית"}
            </p>
            <p className="whitespace-pre-wrap text-sm">{message.text}</p>
          </div>
          <button
            onClick={() => dismiss(message)}
            className="text-sm text-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
