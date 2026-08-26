import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const { id: postId } = await params;

  const scores = await prisma.gameScore.findMany({
    where: { postId },
    orderBy: { score: "desc" },
    take: 10,
    include: { user: { select: { username: true } } },
  });

  return NextResponse.json({
    items: scores.map((s) => ({ username: s.user.username, score: s.score })),
  });
}
