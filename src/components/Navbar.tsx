"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type Props = {
  username: string;
  role: string;
};

const LINKS = [
  { href: "/feed", label: "פיד", icon: "🏠" },
  { href: "/live", label: "לייבים", icon: "🔴" },
  { href: "/ai", label: "מגניב AI", icon: "✨" },
];

export default function Navbar({ username, role }: Props) {
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
        <span className="hidden text-sm text-muted sm:inline">שלום, {username}</span>
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
