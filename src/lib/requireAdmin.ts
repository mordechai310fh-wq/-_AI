import { NextResponse } from "next/server";
import { getCurrentUser, isBanned } from "@/lib/auth";

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN" || isBanned(user)) {
    return { user: null, error: NextResponse.json({ error: "אין הרשאה" }, { status: 403 }) };
  }
  return { user, error: null };
}
