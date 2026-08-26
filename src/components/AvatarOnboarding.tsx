"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";

export default function AvatarOnboarding({ username }: { username: string }) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (dismissed) return null;

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch("/api/upload", { method: "POST", body: fd });
      const upData = await upRes.json();
      if (!upRes.ok) throw new Error(upData.error ?? "שגיאה בהעלאה");

      const patchRes = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: upData.url }),
      });
      const patchData = await patchRes.json();
      if (!patchRes.ok) throw new Error(patchData.error ?? "שגיאה בעדכון");

      setDismissed(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="flex w-full max-w-xs flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center">
        <h2 className="text-lg font-semibold">תוסיף תמונת פרופיל</h2>
        <Avatar username={username} size="lg" />
        <p className="text-sm text-muted">
          כרגע יש לך אווטאר ברירת מחדל עם האות הראשונה של שם המשתמש שלך. אפשר להוסיף תמונה משלך.
        </p>
        {error && <p className="text-sm text-accent">{error}</p>}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <div className="flex w-full gap-2">
          <button
            onClick={() => setDismissed(true)}
            className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground"
          >
            אולי אחר כך
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {uploading ? "מעלה..." : "בחר תמונה"}
          </button>
        </div>
      </div>
    </div>
  );
}
