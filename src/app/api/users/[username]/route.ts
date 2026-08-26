import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const { username } = await params;

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, avatarUrl: true, createdAt: true },
  });
  if (!user) return NextResponse.json({ error: "המשתמש לא נמצא" }, { status: 404 });

  const posts = await prisma.post.findMany({
    where: { authorId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      author: { select: { id: true, username: true, avatarUrl: true } },
      _count: { select: { likes: true, comments: true } },
      likes: { where: { userId: viewer.id }, select: { id: true } },
    },
  });

  return NextResponse.json({
    user,
    posts: posts.map((p) => ({
      id: p.id,
      text: p.text,
      imageUrl: p.imageUrl,
      videoUrl: p.videoUrl,
      audioUrl: p.audioUrl,
      gameCode: p.gameCode,
      gameType: p.gameType,
      gameControls: p.gameControls,
      createdAt: p.createdAt,
      author: p.author,
      likeCount: p._count.likes,
      commentCount: p._count.comments,
      likedByMe: p.likes.length > 0,
    })),
  });
}
