import { NextResponse } from "next/server";
import { getCurrentUser, isBanned } from "@/lib/auth";
import { signSession } from "@/lib/session";

// Short-lived token handed to the browser so it can authenticate with the
// separate realtime (Socket.io) server, which cannot read our httpOnly cookie.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (isBanned(user)) return NextResponse.json({ error: "החשבון שלך מושעה" }, { status: 403 });

  const token = await signSession(
    { sub: user.id, username: user.username, role: user.role },
    "2h"
  );

  return NextResponse.json({ token });
}
