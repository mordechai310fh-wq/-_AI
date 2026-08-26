import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isBanned } from "@/lib/auth";

// 1 game point = 1 coin. Points come from playing "/point" games; this is
// the manual step that turns them into spendable coins.
const schema = z.object({ amount: z.number().int().min(1) });

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (isBanned(user)) return NextResponse.json({ error: "החשבון שלך מושעה" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "קלט לא תקין" }, { status: 400 });
  }

  const spent = await prisma.user.updateMany({
    where: { id: user.id, gamePoints: { gte: parsed.data.amount } },
    data: {
      gamePoints: { decrement: parsed.data.amount },
      coins: { increment: parsed.data.amount },
    },
  });
  if (spent.count === 0) {
    return NextResponse.json({ error: "אין לך מספיק נקודות משחק" }, { status: 400 });
  }

  const updated = await prisma.user.findUnique({
    where: { id: user.id },
    select: { coins: true, gamePoints: true },
  });

  return NextResponse.json(updated);
}
