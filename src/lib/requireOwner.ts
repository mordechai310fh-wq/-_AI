import { NextResponse } from "next/server";
import { getCurrentUser, isBanned } from "@/lib/auth";

export async function requireOwner() {
  const user = await getCurrentUser();
  if (!user || !user.isOwner || isBanned(user)) {
    return { user: null, error: NextResponse.json({ error: "רק בעלים יכול לבצע פעולה זו" }, { status: 403 }) };
  }
  return { user, error: null };
}
