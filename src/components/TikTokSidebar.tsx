const TIKTOK_URL = "https://www.tiktok.com/@amegnivolim?is_from_webapp=1&sender_device=pc";

function TikTokLogo({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="24" fill="#fe2c55" />
      <path
        d="M31.5 14.8c-1.5-1-2.5-2.6-2.7-4.5h-4.4v18.4c0 2.2-1.8 4-4 4a4 4 0 0 1 0-8c.4 0 .8.1 1.2.2v-4.5c-.4 0-.8-.1-1.2-.1-4.6 0-8.3 3.7-8.3 8.4s3.7 8.4 8.3 8.4 8.4-3.7 8.4-8.4v-8.4c1.6 1.1 3.5 1.8 5.6 1.8v-4.4c-1 0-2-.2-2.9-.9Z"
        fill="#fff"
      />
    </svg>
  );
}

export default function TikTokSidebar() {
  return (
    <>
      {/* Desktop: full-height sidebar strip */}
      <a
        href={TIKTOK_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="לעמוד של המגניבולים בטיקטוק"
        className="fixed inset-y-0 start-0 z-40 hidden w-24 flex-col items-center justify-center gap-3 border-e border-border bg-card transition hover:bg-black md:flex"
      >
        <TikTokLogo className="h-14 w-14 shrink-0" />
        <span className="text-sm font-extrabold leading-tight text-foreground">
          לעמוד של
          <br />
          המגניבולים
        </span>
      </a>

      {/* Phone: small floating button, clear of the bottom nav */}
      <a
        href={TIKTOK_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="לעמוד של המגניבולים בטיקטוק"
        className="fixed bottom-20 start-3 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card shadow-lg md:hidden"
      >
        <TikTokLogo className="h-8 w-8 shrink-0" />
      </a>
    </>
  );
}
