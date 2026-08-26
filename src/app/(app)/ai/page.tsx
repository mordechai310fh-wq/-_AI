"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import LockedFeature from "@/components/LockedFeature";
import GameMaker from "@/components/GameMaker";

type Msg = { id: string; role: string; content: string };
type ProjectSummary = { id: string; name: string; updatedAt: string };

function ChatTab({ tier, placeholder }: { tier: "full" | "junior"; placeholder: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const res = await fetch(`/api/ai/projects?tier=${tier}`);
      const data = await res.json();
      if (res.ok) setProjects(data.items);
    } finally {
      setLoadingProjects(false);
    }
  }, [tier]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    setLoading(true);
    const url = activeProjectId
      ? `/api/ai/chat?tier=${tier}&projectId=${activeProjectId}`
      : `/api/ai/chat?tier=${tier}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => setMessages(data.items ?? []))
      .finally(() => setLoading(false));
  }, [tier, activeProjectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function newProject() {
    const res = await fetch("/api/ai/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    const data = await res.json();
    if (!res.ok) return;
    setProjects((prev) => [data.item, ...prev]);
    setActiveProjectId(data.item.id);
  }

  async function deleteProject(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("למחוק את הפרויקט הזה?")) return;
    await fetch(`/api/ai/projects/${id}`, { method: "DELETE" }).catch(() => {});
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeProjectId === id) setActiveProjectId(null);
  }

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
        body: JSON.stringify({ message: text, tier, projectId: activeProjectId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempId),
          data.userMessage,
          data.assistantMessage,
        ]);
        if (activeProjectId) {
          setProjects((prev) => {
            const rest = prev.filter((p) => p.id !== activeProjectId);
            const current = prev.find((p) => p.id === activeProjectId);
            return current ? [{ ...current, updatedAt: new Date().toISOString() }, ...rest] : prev;
          });
        }
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
      <div className="mb-2 flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveProjectId(null)}
          className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
            activeProjectId === null
              ? "border-accent bg-accent/10 text-accent"
              : "border-border text-muted hover:text-foreground"
          }`}
        >
          💬 שיחה כללית
        </button>
        <button
          onClick={newProject}
          className="shrink-0 rounded-full border border-dashed border-accent px-3 py-1 text-xs font-semibold text-accent"
        >
          + פרויקט חדש
        </button>
        {loadingProjects && <span className="text-xs text-muted">טוען...</span>}
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveProjectId(p.id)}
            className={`group flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
              activeProjectId === p.id
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {p.name}
            <span onClick={(e) => deleteProject(p.id, e)} className="opacity-0 group-hover:opacity-100">
              ✕
            </span>
          </button>
        ))}
      </div>

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
              חושב...
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
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
  const { user, loading, hasFullAccess } = useCurrentUser();
  const hasJuniorChat = !!user && user.juniorChatCredits > 0;
  const [tab, setTab] = useState<"chat" | "game" | "junior" | null>(null);

  const activeTab = tab ?? (hasFullAccess ? "chat" : hasJuniorChat ? "junior" : null);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="flex flex-wrap items-center gap-2 p-4 pb-0">
        <span className="text-2xl">✨</span>
        <h1 className="text-xl font-bold">מגניב</h1>
        <span className="text-sm text-muted">העוזר החכם של המגניבולים</span>
      </div>

      {loading ? (
        <p className="p-4 text-sm text-muted">טוען...</p>
      ) : !hasFullAccess && !hasJuniorChat ? (
        <div className="p-4">
          <LockedFeature text="השימוש בעוזר ה-AI ובחילול משחקים דורש גישה מיוחדת, או שאפשר לקנות מגניב ג'וניור בחנות." />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1 p-4 pb-3">
            {hasFullAccess && (
              <button
                onClick={() => setTab("chat")}
                className={`rounded-full px-4 py-1.5 text-sm ${
                  activeTab === "chat" ? "bg-accent text-white" : "border border-border text-muted"
                }`}
              >
                💬 מגניב
              </button>
            )}
            {hasFullAccess && (
              <button
                onClick={() => setTab("game")}
                className={`rounded-full px-4 py-1.5 text-sm ${
                  activeTab === "game" ? "bg-accent text-white" : "border border-border text-muted"
                }`}
              >
                🎮 יצירת משחק
              </button>
            )}
            {hasJuniorChat && (
              <button
                onClick={() => setTab("junior")}
                className={`rounded-full px-4 py-1.5 text-sm ${
                  activeTab === "junior" ? "bg-accent text-white" : "border border-border text-muted"
                }`}
              >
                🔰 מגניב ג&apos;וניור ({user!.juniorChatCredits})
              </button>
            )}
          </div>

          {activeTab === "chat" && <ChatTab key="full" tier="full" placeholder="כתוב הודעה למגניב..." />}
          {activeTab === "game" && <GameMaker />}
          {activeTab === "junior" && (
            <ChatTab key="junior" tier="junior" placeholder="כתוב הודעה למגניב ג'וניור..." />
          )}
        </>
      )}
    </div>
  );
}
