"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Captcha from "@/components/Captcha";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, captchaToken, captchaAnswer }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "שגיאה בהתחברות");
        setLoading(false);
        return;
      }
      router.push("/feed");
      router.refresh();
    } catch {
      setError("שגיאת רשת, נסה שוב");
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-3xl font-extrabold gradient-brand">המגניבולים</h1>
        <p className="mb-8 text-center text-sm text-muted">התחברות לחשבון שלך</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-muted">שם משתמש</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-muted">סיסמה</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          <Captcha
            token={captchaToken}
            answer={captchaAnswer}
            onTokenChange={setCaptchaToken}
            onAnswerChange={setCaptchaAnswer}
          />

          {error && <p className="text-sm text-accent">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-accent py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "מתחבר..." : "התחבר"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          אין לך חשבון?{" "}
          <Link href="/signup" className="text-accent-2 hover:underline">
            הרשמה
          </Link>
        </p>
      </div>
    </main>
  );
}
