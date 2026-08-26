import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isBanned } from "@/lib/auth";

const schema = z.object({
  amount: z.number().int().min(1).max(100_000),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (isBanned(user)) return NextResponse.json({ error: "החשבון שלך מושעה" }, { status: 403 });

  const { id: postId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "קלט לא תקין" }, { status: 400 });
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return NextResponse.json({ error: "הפוסט לא נמצא" }, { status: 404 });
  if (!post.imageUrl && !post.videoUrl) {
    return NextResponse.json({ error: "אפשר לתרום מטבעות רק לפוסטים עם תמונה/וידאו" }, { status: 400 });
  }
  if (post.authorId === user.id) {
    return NextResponse.json({ error: "אי אפשר לתרום לעצמך" }, { status: 400 });
  }

  const spent = await prisma.user.updateMany({
    where: { id: user.id, coins: { gte: parsed.data.amount } },
    data: { coins: { decrement: parsed.data.amount } },
  });
  if (spent.count === 0) {
    return NextResponse.json({ error: "אין לך מספיק מטבעות" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: post.authorId },
    data: { coins: { increment: parsed.data.amount } },
  });

  const donor = await prisma.user.findUnique({ where: { id: user.id }, select: { coins: true } });

  return NextResponse.json({ coins: donor?.coins ?? 0 });
}
