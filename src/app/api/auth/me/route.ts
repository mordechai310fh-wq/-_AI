import { NextResponse } from "next/server";
import { getCurrentUser, isBanned } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      isOwner: user.isOwner,
      hasAccess: user.hasAccess,
      banned: isBanned(user),
      bannedUntil: user.bannedUntil,
      banReason: user.banReason,
    },
  });
}
