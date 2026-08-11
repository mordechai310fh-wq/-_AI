"use client";

import { useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import LockedFeature from "@/components/LockedFeature";
import GameMaker from "@/components/GameMaker";

type Msg = { id: string; role: string; content: string };

function ChatTab() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/ai/chat")
      .then((r) => r.json())
      .then((data) => setMessages(data.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, role: "user", content: text }]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempId),
          data.userMessage,
          data.assistantMessage,
        ]);
      } else {
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempId),
          { id: tempId, role: "user", content: text },
          { id: `${tempId}-err`, role: "assistant", content: `⚠️ ${data.error ?? "שגיאה"}` },
        ]);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-64px-52px-64px)] flex-col p-4 md:h-[calc(100dvh-64px-52px)]">
      <div className="flex-1 overflow-y-auto rounded-2xl border border-border bg-card p-4">
        {loading && <p className="text-sm text-muted">טוען שיחה...</p>}
        {!loading && messages.length === 0 && (
          <p className="text-sm text-muted">שאל אותי כל דבר, אני כאן בשבילך 😊</p>
        )}
        <div className="flex flex-col gap-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                m.role === "user"
                  ? "self-end bg-accent text-white"
                  : "self-start bg-background text-foreground"
              }`}
            >
              {m.content}
            </div>
          ))}
          {sending && (
            <div className="self-start rounded-2xl bg-background px-4 py-2 text-sm text-muted">
              מגניב חושב...
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="כתוב הודעה למגניב..."
          className="flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          שלח
        </button>
      </form>
    </div>
  );
}

export default function AiPage() {
  const { loading, hasFullAccess } = useCurrentUser();
  const [tab, setTab] = useState<"chat" | "game">("chat");

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="flex items-center gap-2 p-4 pb-0">
        <span className="text-2xl">✨</span>
        <h1 className="text-xl font-bold">מגניב</h1>
        <span className="text-sm text-muted">העוזר החכם של המגניבולים</span>
      </div>

      {loading ? (
        <p className="p-4 text-sm text-muted">טוען...</p>
      ) : !hasFullAccess ? (
        <div className="p-4">
          <LockedFeature text="השימוש בעוזר ה-AI ובחילול משחקים דורש גישה מיוחדת." />
        </div>
      ) : (
        <>
          <div className="flex gap-1 p-4 pb-3">
            <button
              onClick={() => setTab("chat")}
              className={`rounded-full px-4 py-1.5 text-sm ${
                tab === "chat" ? "bg-accent text-white" : "border border-border text-muted"
              }`}
            >
              💬 צ&apos;אט
            </button>
            <button
              onClick={() => setTab("game")}
              className={`rounded-full px-4 py-1.5 text-sm ${
                tab === "game" ? "bg-accent text-white" : "border border-border text-muted"
              }`}
            >
              🎮 יצירת משחק
            </button>
          </div>

          {tab === "chat" ? <ChatTab /> : <GameMaker />}
        </>
      )}
    </div>
  );
}
