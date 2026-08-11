"use client";

import { useRef, useState } from "react";
import type { PostItem } from "@/lib/types";

type MediaKind = "image" | "video" | null;

export default function CreatePostModal({ onCreated }: { onCreated: (post: PostItem) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaKind, setMediaKind] = useState<MediaKind>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setText("");
    setMediaFile(null);
    setMediaKind(null);
    setPreview(null);
    setAudioFile(null);
    setError(null);
  }

  function handleMedia(f: File | null, kind: MediaKind) {
    setMediaFile(f);
    setMediaKind(kind);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  // The server can occasionally respond with an empty/non-JSON body (e.g. a
  // free-tier server waking up from sleep, or a dropped connection on a slow
  // upload) - res.json() throws a cryptic "Unexpected end of JSON input" in
  // that case. Give a clear, actionable message instead.
  async function safeJson(res: Response) {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("השרת לא הגיב כראוי (יכול לקרות אחרי חוסר פעילות). נסה שוב בעוד רגע.");
    }
  }

  async function uploadFile(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error ?? "שגיאה בהעלאה");
    return data.url;
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
      let videoUrl: string | null = null;
      let audioUrl: string | null = null;

      if (mediaFile && mediaKind === "image") imageUrl = await uploadFile(mediaFile);
      if (mediaFile && mediaKind === "video") videoUrl = await uploadFile(mediaFile);
      if (audioFile) audioUrl = await uploadFile(audioFile);

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, imageUrl, videoUrl, audioUrl }),
      });
      const data = await safeJson(res);
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
        className="fixed bottom-20 left-1/2 z-40 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-accent text-2xl text-white shadow-lg transition hover:opacity-90 md:bottom-6"
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
            className="flex max-h-[90vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-card p-5"
          >
            <h2 className="text-lg font-semibold">פוסט חדש</h2>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="מה קורה?"
              className="resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-accent"
            />

            {preview && mediaKind === "image" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="תצוגה מקדימה" className="max-h-56 w-full rounded-lg object-cover" />
            )}
            {preview && mediaKind === "video" && (
              <video src={preview} controls className="max-h-56 w-full rounded-lg object-cover" />
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
              >
                🖼️ תמונה
              </button>
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
              >
                🎬 וידאו
              </button>
              {mediaFile && (
                <button
                  type="button"
                  onClick={() => handleMedia(null, null)}
                  className="text-sm text-muted hover:text-foreground"
                >
                  הסר מדיה
                </button>
              )}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => handleMedia(e.target.files?.[0] ?? null, "image")}
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={(e) => handleMedia(e.target.files?.[0] ?? null, "video")}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
              >
                🎵 {mediaKind === "video" ? "הוסף/החלף סאונד לוידאו" : "הוסף סאונד"}
              </button>
              {audioFile && (
                <>
                  <span className="text-xs text-muted">{audioFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setAudioFile(null)}
                    className="text-sm text-muted hover:text-foreground"
                  >
                    הסר
                  </button>
                </>
              )}
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/mpeg,audio/mp4,audio/wav,audio/ogg"
                className="hidden"
                onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
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
