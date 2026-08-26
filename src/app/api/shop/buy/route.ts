import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isBanned } from "@/lib/auth";

const SHOP_ITEMS = {
  "post-credit-1": { cost: 500, target: "postCredits" as const, amount: 1 },
  "post-credit-15": { cost: 6000, target: "postCredits" as const, amount: 15 },
  "junior-chat": { cost: 1000, target: "juniorChatCredits" as const, amount: 50 },
};

const schema = z.object({ item: z.enum(["post-credit-1", "post-credit-15", "junior-chat"]) });

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (isBanned(user)) return NextResponse.json({ error: "החשבון שלך מושעה" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "קלט לא תקין" }, { status: 400 });
  }

  const item = SHOP_ITEMS[parsed.data.item];

  const spent = await prisma.user.updateMany({
    where: { id: user.id, coins: { gte: item.cost } },
    data: {
      coins: { decrement: item.cost },
      ...(item.target === "postCredits"
        ? { postCredits: { increment: item.amount } }
        : { juniorChatCredits: { increment: item.amount } }),
    },
  });

  if (spent.count === 0) {
    return NextResponse.json({ error: "אין לך מספיק מטבעות" }, { status: 400 });
  }

  const updated = await prisma.user.findUnique({
    where: { id: user.id },
    select: { coins: true, postCredits: true, juniorChatCredits: true },
  });

  return NextResponse.json(updated);
}
