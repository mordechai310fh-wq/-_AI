"use client";

import { useState } from "react";
import { useCurrentUser } from "@/lib/useCurrentUser";

type ItemKey = "post-credit-1" | "post-credit-15" | "junior-chat";

const ITEMS: { key: ItemKey; title: string; desc: string; cost: number; emoji: string }[] = [
  {
    key: "post-credit-1",
    title: "העלאת וידאו אחת",
    desc: "מאפשר לך לפרסם סרטון אחד לפיד, גם בלי גישה מלאה.",
    cost: 500,
    emoji: "🎬",
  },
  {
    key: "post-credit-15",
    title: "חבילת 15 העלאות וידאו",
    desc: "15 העלאות וידאו במחיר מוזל (במקום 7,500 מטבעות).",
    cost: 6000,
    emoji: "📦",
  },
  {
    key: "junior-chat",
    title: "מגניב ג'וניור",
    desc: "50 הודעות צ'אט עם מגניב, גם בלי גישה מלאה ל-AI.",
    cost: 1000,
    emoji: "✨",
  },
];

export default function ShopClient() {
  const { user, loading } = useCurrentUser();
  const [coins, setCoins] = useState<number | null>(null);
  const [gamePoints, setGamePoints] = useState<number | null>(null);
  const [postCredits, setPostCredits] = useState<number | null>(null);
  const [juniorChatCredits, setJuniorChatCredits] = useState<number | null>(null);
  const [buying, setBuying] = useState<ItemKey | null>(null);
  const [exchanging, setExchanging] = useState(false);
  const [exchangeAmount, setExchangeAmount] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const displayCoins = coins ?? user?.coins ?? 0;
  const displayGamePoints = gamePoints ?? user?.gamePoints ?? 0;
  const displayPostCredits = postCredits ?? user?.postCredits ?? 0;
  const displayJuniorChat = juniorChatCredits ?? user?.juniorChatCredits ?? 0;

  async function buy(item: ItemKey) {
    if (buying) return;
    setBuying(item);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/shop/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה");
      setCoins(data.coins);
      setPostCredits(data.postCredits);
      setJuniorChatCredits(data.juniorChatCredits);
      setMessage("הקנייה בוצעה בהצלחה!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setBuying(null);
    }
  }

  async function exchangePoints() {
    if (exchanging || exchangeAmount < 1) return;
    setExchanging(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/shop/exchange-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: exchangeAmount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה");
      setCoins(data.coins);
      setGamePoints(data.gamePoints);
      setMessage("ההמרה בוצעה בהצלחה!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setExchanging(false);
    }
  }

  if (loading) return null;

  return (
    <div className="mx-auto w-full max-w-2xl p-4 pb-20 md:pb-4">
      <div className="mb-6 flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-muted">היתרה שלך</p>
        <p className="text-2xl font-bold">🪙 {displayCoins}</p>
        <p className="mt-1 text-xs text-muted">
          יש לך {displayPostCredits} העלאות וידאו זמינות ו-{displayJuniorChat} הודעות מגניב ג&apos;וניור.
        </p>
        <p className="mt-2 text-xs text-muted">
          איך משיגים נקודות? שחקו במשחקים שנוצרו עם <span className="font-mono">/point</span> ב-מגניב AI.
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">🎯 נקודות משחק: {displayGamePoints}</p>
        <p className="text-xs text-muted">אפשר להמיר נקודות משחק למטבעות (1 נקודה = 1 מטבע).</p>
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            max={displayGamePoints || undefined}
            value={exchangeAmount}
            onChange={(e) => setExchangeAmount(Number(e.target.value))}
            className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            onClick={exchangePoints}
            disabled={exchanging || displayGamePoints < exchangeAmount || exchangeAmount < 1}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {exchanging ? "ממיר..." : "המר למטבעות"}
          </button>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-accent">{error}</p>}
      {message && <p className="mb-4 text-sm text-emerald-500">{message}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ITEMS.map((item) => (
          <div key={item.key} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
            <p className="text-3xl">{item.emoji}</p>
            <p className="font-semibold">{item.title}</p>
            <p className="text-sm text-muted">{item.desc}</p>
            <button
              onClick={() => buy(item.key)}
              disabled={buying !== null || displayCoins < item.cost}
              className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {buying === item.key ? "קונה..." : `קנה ב-${item.cost} 🪙`}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
