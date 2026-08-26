import { redirect } from "next/navigation";
import { getCurrentUser, isBanned } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import LogoutButton from "@/components/LogoutButton";
import AvatarOnboarding from "@/components/AvatarOnboarding";
import MessageInbox from "@/components/MessageInbox";
import TikTokSidebar from "@/components/TikTokSidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (isBanned(user)) {
    const until = user.bannedUntil ? new Date(user.bannedUntil).toLocaleString("he-IL") : "";
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-bold text-accent">החשבון שלך הושעה</h1>
        <p className="text-muted">אתה חסום עד: {until}</p>
        {user.banReason && <p className="text-sm text-muted">סיבה: {user.banReason}</p>}
        <LogoutButton className="mt-2 rounded-lg border border-border px-4 py-2 text-sm hover:text-foreground" />
      </main>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col md:ps-24">
      <TikTokSidebar />
      <Navbar username={user.username} role={user.role} avatarUrl={user.avatarUrl} />
      <div className="flex flex-1 flex-col">{children}</div>
      <BottomNav role={user.role} />
      {!user.avatarUrl && <AvatarOnboarding username={user.username} />}
      <MessageInbox />
    </div>
  );
}
