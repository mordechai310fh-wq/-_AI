"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function GameMaker() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [refImageUrl, setRefImageUrl] = useState<string | null>(null);
  const [uploadingRef, setUploadingRef] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [controls, setControls] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const previewRef = useRef<HTMLIFrameElement>(null);
  const refImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (code) previewRef.current?.focus();
  }, [code]);

  async function handleRefImage(file: File) {
    setUploadingRef(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה בהעלאה");
      setRefImageUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setUploadingRef(false);
    }
  }

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setError(null);
    setCode(null);
    setControls(null);
    setPublished(false);
    try {
      const res = await fetch("/api/ai/generate-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, imageUrl: refImageUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה ביצירת המשחק");
      setCode(data.code);
      setControls(data.controls ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setGenerating(false);
    }
  }

  async function publish() {
    if (!code || publishing) return;
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🎮 משחק שנוצר עם מגניב: ${prompt}`,
          gameCode: code,
          gameType: "2D",
          gameControls: controls,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה בפרסום");
      setPublished(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-64px)] flex-col gap-4 overflow-y-auto p-4 pb-20 md:pb-4">
      <form onSubmit={generate} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <label className="text-sm text-muted">תאר את המשחק שאתה רוצה שמגניב ייצור</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="לדוגמה: משחק שבו קופצים בין פלטפורמות ואוספים מטבעות"
          className="resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-accent"
        />
        <p className="text-xs text-muted">
          💡 תוסיף <span className="font-mono text-accent">/point</span> לתיאור כדי שהניקוד במשחק יהפוך למטבעות אמיתיים שאפשר להוציא בחנות.
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refImageInputRef.current?.click()}
            disabled={uploadingRef}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground disabled:opacity-50"
          >
            {uploadingRef ? "מעלה..." : "📎 הוסף תמונת רפרנס"}
          </button>
          {refImageUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={refImageUrl} alt="רפרנס" className="h-10 w-10 rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => setRefImageUrl(null)}
                className="text-sm text-muted hover:text-foreground"
              >
                הסר
              </button>
            </>
          )}
          <input
            ref={refImageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleRefImage(file);
            }}
          />
        </div>
        {refImageUrl && (
          <p className="text-xs text-muted">התמונה תשמש כדמות/סמל הראשי במשחק.</p>
        )}

        {error && <p className="text-sm text-accent">{error}</p>}

        <button
          type="submit"
          disabled={generating || !prompt.trim()}
          className="rounded-lg bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {generating ? "מגניב יוצר את המשחק..." : "✨ צור משחק"}
        </button>
      </form>

      {code && (
        <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">תצוגה מקדימה</h2>
            {published ? (
              <button
                onClick={() => router.push("/feed")}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white"
              >
                פורסם! מעבר לפיד →
              </button>
            ) : (
              <button
                onClick={publish}
                disabled={publishing}
                className="rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {publishing ? "מפרסם..." : "פרסם לפיד"}
              </button>
            )}
          </div>
          {controls && (
            <p className="rounded-lg bg-background px-3 py-2 text-xs text-muted">
              🎮 שליטה: {controls}
            </p>
          )}
          <div className="flex-1 overflow-hidden rounded-xl bg-black">
            <iframe
              ref={previewRef}
              title="תצוגה מקדימה"
              srcDoc={code}
              sandbox="allow-scripts"
              onLoad={() => previewRef.current?.focus()}
              className="h-full min-h-[400px] w-full border-0"
            />
          </div>
        </div>
      )}
    </div>
  );
}
