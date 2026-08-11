"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/feed", label: "פיד", icon: "🏠" },
  { href: "/live", label: "לייבים", icon: "🔴" },
  { href: "/ai", label: "מגניב", icon: "✨" },
];

export default function BottomNav({ role }: { role: string }) {
  const pathname = usePathname();

  // Live rooms want the full screen - no floating nav bar over the video.
  if (/^\/live\/.+/.test(pathname)) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border bg-background/90 py-2 backdrop-blur md:hidden">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`flex flex-col items-center gap-0.5 rounded-lg px-4 py-1 text-xs ${
            pathname.startsWith(link.href) ? "text-accent" : "text-muted"
          }`}
        >
          <span className="text-xl">{link.icon}</span>
          {link.label}
        </Link>
      ))}
      {role === "ADMIN" && (
        <Link
          href="/admin"
          className={`flex flex-col items-center gap-0.5 rounded-lg px-4 py-1 text-xs ${
            pathname.startsWith("/admin") ? "text-accent" : "text-muted"
          }`}
        >
          <span className="text-xl">🛠️</span>
          ניהול
        </Link>
      )}
    </nav>
  );
}
