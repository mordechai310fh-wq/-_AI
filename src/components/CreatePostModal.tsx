"use client";

import { useRef, useState } from "react";
import type { PostItem } from "@/lib/types";

export default function CreatePostModal({ onCreated }: { onCreated: (post: PostItem) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setText("");
    setFile(null);
    setPreview(null);
    setError(null);
  }

  function handleFile(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      setError("כתוב משהו קודם");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let imageUrl: string | null = null;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const upRes = await fetch("/api/upload", { method: "POST", body: fd });
        const upData = await upRes.json();
        if (!upRes.ok) throw new Error(upData.error ?? "שגיאה בהעלאת תמונה");
        imageUrl = upData.url;
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה בפרסום");

      onCreated(data.item);
      reset();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-1/2 z-40 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-accent text-2xl text-white shadow-lg transition hover:opacity-90"
        title="פוסט חדש"
      >
        +
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setOpen(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={submit}
            className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-border bg-card p-5"
          >
            <h2 className="text-lg font-semibold">פוסט חדש</h2>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="מה קורה?"
              className="resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-accent"
            />

            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="תצוגה מקדימה" className="max-h-56 w-full rounded-lg object-cover" />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
              >
                🖼️ הוסף תמונה
              </button>
              {file && (
                <button
                  type="button"
                  onClick={() => handleFile(null)}
                  className="text-sm text-muted hover:text-foreground"
                >
                  הסר
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {error && <p className="text-sm text-accent">{error}</p>}

            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground"
              >
                ביטול
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading ? "מפרסם..." : "פרסם"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
