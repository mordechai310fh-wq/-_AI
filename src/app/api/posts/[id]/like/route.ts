import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isBanned } from "@/lib/auth";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (isBanned(user)) return NextResponse.json({ error: "החשבון שלך מושעה" }, { status: 403 });

  const { id: postId } = await params;

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return NextResponse.json({ error: "הפוסט לא נמצא" }, { status: 404 });

  const existing = await prisma.like.findUnique({
    where: { postId_userId: { postId, userId: user.id } },
  });

  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
  } else {
    await prisma.like.create({ data: { postId, userId: user.id } });
  }

  const likeCount = await prisma.like.count({ where: { postId } });

  return NextResponse.json({ liked: !existing, likeCount });
}
