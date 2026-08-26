import { NextResponse } from "next/server";
import { getCurrentUser, isBanned } from "@/lib/auth";

// Video posting and AI usage are gated behind an owner/admin-granted
// "access" flag, separate from the ADMIN role. Users without it can still
// buy limited access per-use in the shop (see /api/shop/buy).
export async function requireAccess() {
  const user = await getCurrentUser();
  if (!user || isBanned(user)) {
    return { user: null, error: NextResponse.json({ error: "אין הרשאה" }, { status: 401 }) };
  }
  if (!user.isOwner && !user.hasAccess) {
    return {
      user: null,
      error: NextResponse.json({ error: "אין לך גישה לתכונה הזו. בקש גישה ממנהל" }, { status: 403 }),
    };
  }
  return { user, error: null };
}
