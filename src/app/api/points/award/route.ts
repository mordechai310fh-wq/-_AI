import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isBanned } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";

// AI-generated games (sandboxed, allow-scripts only) report score increases
// via postMessage - see GamePostFrame.tsx. Since that game code isn't
// trustworthy, every award is capped hard and rate-limited per user so a
// buggy or malicious game can't mint unlimited coins.
const MAX_POINTS_PER_CALL = 20;

const schema = z.object({
  postId: z.string(),
  points: z.number().finite().positive(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (isBanned(user)) return NextResponse.json({ error: "החשבון שלך מושעה" }, { status: 403 });

  const rl = checkRateLimit(`points-award:${user.id}`, 30, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "יותר מדי בקשות" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "קלט לא תקין" }, { status: 400 });
  }

  const post = await prisma.post.findUnique({ where: { id: parsed.data.postId } });
  if (!post || !post.gameCode) {
    return NextResponse.json({ error: "המשחק לא נמצא" }, { status: 404 });
  }

  const awarded = Math.min(Math.floor(parsed.data.points), MAX_POINTS_PER_CALL);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { coins: { increment: awarded } },
  });

  return NextResponse.json({ awarded, coins: updated.coins });
}
