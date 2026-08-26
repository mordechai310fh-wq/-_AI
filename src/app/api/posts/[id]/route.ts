import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isBanned } from "@/lib/auth";
import { isAdminUser } from "@/lib/isAdmin";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (isBanned(user)) return NextResponse.json({ error: "החשבון שלך מושעה" }, { status: 403 });

  const { id: postId } = await params;

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return NextResponse.json({ error: "הפוסט לא נמצא" }, { status: 404 });

  // Owners/admins can delete anyone's post; everyone else only their own.
  if (post.authorId !== user.id && !isAdminUser(user)) {
    return NextResponse.json({ error: "אין לך הרשאה למחוק פוסט זה" }, { status: 403 });
  }

  await prisma.post.delete({ where: { id: postId } });

  return NextResponse.json({ ok: true });
}
