import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";

const schema = z.object({
  userId: z.string().min(1),
  amount: z.number().int().min(-1_000_000).max(1_000_000),
});

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "קלט לא תקין" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });

  const newBalance = Math.max(0, target.coins + parsed.data.amount);
  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { coins: newBalance },
  });

  return NextResponse.json({ item: { id: updated.id, username: updated.username, coins: updated.coins } });
}
