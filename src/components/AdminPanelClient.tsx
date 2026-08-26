"use client";

import { useEffect, useState } from "react";

type AdminUser = {
  id: string;
  username: string;
  role: string;
  isOwner: boolean;
  hasAccess: boolean;
  bannedUntil: string | null;
  banReason: string | null;
  coins: number;
  postCredits: number;
  juniorChatCredits: number;
  createdAt: string;
};

const BAN_PRESETS = [
  { label: "שעה", hours: 1 },
  { label: "24 שעות", hours: 24 },
  { label: "7 ימים", hours: 24 * 7 },
  { label: "30 יום", hours: 24 * 30 },
  { label: "לצמיתות", hours: 24 * 365 * 10 },
];

export default function AdminPanelClient({
  currentUserId,
  currentUserIsOwner,
}: {
  currentUserId: string;
  currentUserIsOwner: boolean;
}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [banTarget, setBanTarget] = useState<string | null>(null);
  const [banHours, setBanHours] = useState(24);
  const [banReason, setBanReason] = useState("");
  const [coinsTarget, setCoinsTarget] = useState<string | null>(null);
  const [coinsAmount, setCoinsAmount] = useState(1000);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (res.ok) setUsers(data.items);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function isBanned(u: AdminUser) {
    return !!u.bannedUntil && new Date(u.bannedUntil).getTime() > Date.now();
  }

  async function submitBan(userId: string) {
    setBusyId(userId);
    setError(null);
    try {
      const res = await fetch("/api/admin/ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, hours: banHours, reason: banReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה");
      setBanTarget(null);
      setBanReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setBusyId(null);
    }
  }

  async function unban(userId: string) {
    setBusyId(userId);
    setError(null);
    try {
      const res = await fetch("/api/admin/unban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "שגיאה");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleAccess(u: AdminUser) {
    setBusyId(u.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id, hasAccess: !u.hasAccess }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleOwner(u: AdminUser) {
    setBusyId(u.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id, isOwner: !u.isOwner }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setBusyId(null);
    }
  }

  async function submitCoins(userId: string) {
    setBusyId(userId);
    setError(null);
    try {
      const res = await fetch("/api/admin/coins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, amount: coinsAmount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה");
      setCoinsTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleRole(u: AdminUser) {
    setBusyId(u.id);
    setError(null);
    try {
      const newRole = u.role === "ADMIN" ? "USER" : "ADMIN";
      const res = await fetch("/api/admin/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-4 pb-20 md:pb-4">
      <h1 className="mb-1 text-2xl font-bold">🛠️ פאנל ניהול</h1>
      <p className="mb-6 text-sm text-muted">ניהול משתמשים, חסימות והרשאות מנהל</p>

      {error && <p className="mb-4 text-sm text-accent">{error}</p>}
      {loading && <p className="text-sm text-muted">טוען משתמשים...</p>}

      <div className="flex flex-col gap-3">
        {users.map((u) => {
          const banned = isBanned(u);
          return (
            <div key={u.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{u.username}</span>
                    {u.isOwner && (
                      <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent">
                        👑 בעלים
                      </span>
                    )}
                    {!u.isOwner && u.role === "ADMIN" && (
                      <span className="rounded-full bg-accent-2/20 px-2 py-0.5 text-xs text-accent-2">
                        מנהל
                      </span>
                    )}
                    {(u.isOwner || u.hasAccess) && (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
                        ✨ גישה מלאה ל-AI ווידאו
                      </span>
                    )}
                    <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400">
                      🪙 {u.coins}
                    </span>
                    {banned && (
                      <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
                        חסום עד {new Date(u.bannedUntil!).toLocaleString("he-IL")}
                      </span>
                    )}
                  </div>
                  {banned && u.banReason && (
                    <p className="mt-1 text-xs text-muted">סיבה: {u.banReason}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setCoinsTarget(coinsTarget === u.id ? null : u.id)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground"
                  >
                    🪙 תן מטבעות
                  </button>

                  {(!u.isOwner || (currentUserIsOwner && u.id !== currentUserId)) && (
                    <>
                    {!u.isOwner && (
                      <button
                        onClick={() => toggleAccess(u)}
                        disabled={busyId === u.id}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                          u.hasAccess
                            ? "border border-border text-muted hover:text-foreground"
                            : "bg-emerald-600 text-white"
                        }`}
                      >
                        {u.hasAccess ? "הסר גישה מלאה" : "תן גישה מלאה (AI + וידאו)"}
                      </button>
                    )}

                    {currentUserIsOwner && u.id !== currentUserId && (
                      <button
                        onClick={() => toggleOwner(u)}
                        disabled={busyId === u.id}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                          u.isOwner
                            ? "border border-border text-muted hover:text-foreground"
                            : "bg-amber-500 text-white"
                        }`}
                      >
                        {u.isOwner ? "הסר בעלות" : "👑 הפוך לבעלים"}
                      </button>
                    )}

                    {!u.isOwner && u.id !== currentUserId && (
                      <>
                        <button
                          onClick={() => toggleRole(u)}
                          disabled={busyId === u.id}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground disabled:opacity-50"
                        >
                          {u.role === "ADMIN" ? "הסר הרשאות מנהל" : "הפוך למנהל"}
                        </button>
                        {banned ? (
                          <button
                            onClick={() => unban(u.id)}
                            disabled={busyId === u.id}
                            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground disabled:opacity-50"
                          >
                            בטל חסימה
                          </button>
                        ) : (
                          <button
                            onClick={() => setBanTarget(banTarget === u.id ? null : u.id)}
                            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            חסום
                          </button>
                        )}
                      </>
                    )}
                    </>
                  )}
                  </div>
              </div>

              {coinsTarget === u.id && (
                <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted">כמות מטבעות (שלילי כדי להוריד):</label>
                    <input
                      type="number"
                      value={coinsAmount}
                      onChange={(e) => setCoinsAmount(Number(e.target.value))}
                      className="w-28 rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-accent"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setCoinsTarget(null)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted"
                    >
                      ביטול
                    </button>
                    <button
                      onClick={() => submitCoins(u.id)}
                      disabled={busyId === u.id}
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      אשר
                    </button>
                  </div>
                </div>
              )}

              {banTarget === u.id && (
                <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                  <div className="flex flex-wrap gap-1.5">
                    {BAN_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        onClick={() => setBanHours(p.hours)}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          banHours === p.hours
                            ? "border-accent bg-accent text-white"
                            : "border-border text-muted hover:text-foreground"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted">או מספר שעות מותאם:</label>
                    <input
                      type="number"
                      min={1}
                      value={banHours}
                      onChange={(e) => setBanHours(Number(e.target.value))}
                      className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-accent"
                    />
                  </div>
                  <input
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="סיבת החסימה (לא חובה)"
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-accent"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setBanTarget(null)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted"
                    >
                      ביטול
                    </button>
                    <button
                      onClick={() => submitBan(u.id)}
                      disabled={busyId === u.id}
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      אשר חסימה
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
