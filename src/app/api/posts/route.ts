import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { requireAccess } from "@/lib/requireAccess";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const cursor = req.nextUrl.searchParams.get("cursor");

  const posts = await prisma.post.findMany({
    take: 10,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, username: true } },
      _count: { select: { likes: true, comments: true } },
      likes: { where: { userId: user.id }, select: { id: true } },
    },
  });

  const items = posts.map((p) => ({
    id: p.id,
    text: p.text,
    imageUrl: p.imageUrl,
    gameCode: p.gameCode,
    gameType: p.gameType,
    gameControls: p.gameControls,
    createdAt: p.createdAt,
    author: p.author,
    likeCount: p._count.likes,
    commentCount: p._count.comments,
    likedByMe: p.likes.length > 0,
  }));

  return NextResponse.json({
    items,
    nextCursor: posts.length === 10 ? posts[posts.length - 1].id : null,
  });
}

const createSchema = z.object({
  text: z.string().trim().min(1, "כתוב משהו").max(2000, "הטקסט ארוך מדי"),
  imageUrl: z.string().optional().nullable(),
  gameCode: z.string().max(200_000, "קוד המשחק גדול מדי").optional().nullable(),
  gameType: z.enum(["2D"]).optional().nullable(),
  gameControls: z.string().max(300).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "קלט לא תקין" }, { status: 400 });
  }

  const { user, error } = await requireAccess();
  if (error) return error;

  const post = await prisma.post.create({
    data: {
      authorId: user.id,
      text: parsed.data.text,
      imageUrl: parsed.data.imageUrl || null,
      gameCode: parsed.data.gameCode || null,
      gameType: parsed.data.gameType || null,
      gameControls: parsed.data.gameControls || null,
    },
    include: {
      author: { select: { id: true, username: true } },
    },
  });

  return NextResponse.json({
    item: {
      id: post.id,
      text: post.text,
      imageUrl: post.imageUrl,
      gameCode: post.gameCode,
      gameType: post.gameType,
      gameControls: post.gameControls,
      createdAt: post.createdAt,
      author: post.author,
      likeCount: 0,
      commentCount: 0,
      likedByMe: false,
    },
  });
}
