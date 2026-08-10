"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  token: string;
  answer: string;
  onTokenChange: (token: string) => void;
  onAnswerChange: (answer: string) => void;
};

export default function Captcha({ token, answer, onTokenChange, onAnswerChange }: Props) {
  const [question, setQuestion] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/captcha");
      const data = await res.json();
      setQuestion(data.question);
      onTokenChange(data.token);
      onAnswerChange("");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm text-muted">אימות אנושי: כמה זה {question || "..."}</label>
      <div className="flex gap-2">
        <input
          type="number"
          required
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value)}
          placeholder="התשובה שלך"
          className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
          title="שאלה חדשה"
        >
          ↻
        </button>
      </div>
      <input type="hidden" value={token} readOnly />
    </div>
  );
}
