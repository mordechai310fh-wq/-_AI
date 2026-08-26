const COLORS = [
  "#f43f5e", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

function colorFor(username: string) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

const SIZE_CLASSES: Record<string, string> = {
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-base",
  lg: "h-24 w-24 text-3xl",
};

export default function Avatar({
  username,
  avatarUrl,
  size = "md",
  className = "",
}: {
  username: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClass = SIZE_CLASSES[size];

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={username}
        className={`${sizeClass} shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      style={{ backgroundColor: colorFor(username) }}
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full font-bold text-white ${className}`}
    >
      {username.charAt(0).toUpperCase()}
    </div>
  );
}
