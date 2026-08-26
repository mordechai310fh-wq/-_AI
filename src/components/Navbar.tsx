"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";

type Props = {
  username: string;
  role: string;
  avatarUrl: string | null;
};

const LINKS = [
  { href: "/feed", label: "פיד", icon: "🏠" },
  { href: "/shop", label: "חנות", icon: "🛍️" },
  { href: "/ai", label: "מגניב AI", icon: "✨" },
];

export default function Navbar({ username, role, avatarUrl }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
      <Link href="/feed" className="text-xl font-extrabold gradient-brand">
        המגניבולים
      </Link>

      <nav className="hidden items-center gap-1 rounded-full border border-border bg-card p-1 md:flex">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-full px-3 py-1.5 text-sm transition ${
              pathname.startsWith(link.href)
                ? "bg-accent text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            <span className="ml-1">{link.icon}</span>
            {link.label}
          </Link>
        ))}
        {role === "ADMIN" && (
          <Link
            href="/admin"
            className={`rounded-full px-3 py-1.5 text-sm transition ${
              pathname.startsWith("/admin")
                ? "bg-accent text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            <span className="ml-1">🛠️</span>
            ניהול
          </Link>
        )}
      </nav>

      <div className="flex items-center gap-3">
        <Link href={`/u/${username}`} className="flex items-center gap-2" title="הפרופיל שלי">
          <span className="hidden text-sm text-muted sm:inline">{username}</span>
          <Avatar username={username} avatarUrl={avatarUrl} size="sm" />
        </Link>
        <button
          onClick={logout}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
        >
          התנתק
        </button>
      </div>
    </header>
  );
}
