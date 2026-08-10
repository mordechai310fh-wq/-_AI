"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/useCurrentUser";
import LockedFeature from "@/components/LockedFeature";

type Room = {
  id: string;
  title: string;
  host: { id: string; username: string };
  createdAt: string;
};

export default function LivePage() {
  const router = useRouter();
  const { loading: userLoading, hasFullAccess } = useCurrentUser();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const res = await fetch("/api/live");
      const data = await res.json();
      if (active) {
        setRooms(data.items ?? []);
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  async function goLive(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה");
      router.push(`/live/${data.item.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
      setStarting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-4">
      {userLoading ? null : hasFullAccess ? (
        <form
          onSubmit={goLive}
          className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="על מה הלייב שלך?"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={starting}
            className="whitespace-nowrap rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            🔴 {starting ? "מתחיל..." : "התחל לייב"}
          </button>
        </form>
      ) : (
        <div className="mb-6">
          <LockedFeature text="שידור לייב דורש גישה מיוחדת. אתה עדיין יכול לצפות בלייבים ולהשתתף בצ'אט." />
        </div>
      )}
      {error && <p className="mb-4 text-sm text-accent">{error}</p>}

      <h2 className="mb-3 text-lg font-semibold">לייבים עכשיו</h2>
      {loading && <p className="text-sm text-muted">טוען...</p>}
      {!loading && rooms.length === 0 && (
        <p className="text-sm text-muted">אין כרגע לייבים פעילים. תתחיל אחד!</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rooms.map((room) => (
          <button
            key={room.id}
            onClick={() => router.push(`/live/${room.id}`)}
            className="flex flex-col items-start gap-1 rounded-xl border border-border bg-card p-4 text-right transition hover:border-accent"
          >
            <div className="flex items-center gap-2 text-accent">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
              <span className="text-xs font-semibold">LIVE</span>
            </div>
            <p className="font-semibold">{room.title}</p>
            <p className="text-sm text-muted">@{room.host.username}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
