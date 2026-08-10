"use client";

import { useEffect, useState } from "react";
import type { CommentItem } from "@/lib/types";

type Props = {
  postId: string;
  open: boolean;
  onClose: () => void;
  onCommentAdded: () => void;
};

export default function CommentDrawer({ postId, open, onClose, onCommentAdded }: Props) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/posts/${postId}/comments`)
      .then((r) => r.json())
      .then((data) => setComments(data.items ?? []))
      .finally(() => setLoading(false));
  }, [open, postId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (res.ok) {
        setComments((prev) => [...prev, data.item]);
        setText("");
        onCommentAdded();
      }
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[75vh] w-full max-w-md flex-col rounded-t-2xl border border-border bg-card"
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-semibold">תגובות</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading && <p className="text-sm text-muted">טוען תגובות...</p>}
          {!loading && comments.length === 0 && (
            <p className="text-sm text-muted">אין עדיין תגובות. היה הראשון!</p>
          )}
          <ul className="flex flex-col gap-3">
            {comments.map((c) => (
              <li key={c.id} className="text-sm">
                <span className="font-semibold">{c.author.username}</span>{" "}
                <span className="text-foreground/90">{c.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <form onSubmit={submit} className="flex gap-2 border-t border-border p-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="הוסף תגובה..."
            className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={sending}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            שלח
          </button>
        </form>
      </div>
    </div>
  );
}
