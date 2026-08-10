export default function LockedFeature({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-8 text-center">
      <span className="text-3xl">🔒</span>
      <p className="text-sm text-muted">{text}</p>
      <p className="text-xs text-muted">בקש מהמנהל גישה מפאנל הניהול</p>
    </div>
  );
}
