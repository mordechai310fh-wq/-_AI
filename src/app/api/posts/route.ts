import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isBanned } from "@/lib/auth";
import { isAdminUser } from "@/lib/isAdmin";
import { moderateImage } from "@/lib/moderation";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const cursor = req.nextUrl.searchParams.get("cursor");

  const posts = await prisma.post.findMany({
    take: 10,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, username: true, avatarUrl: true } },
      _count: { select: { likes: true, comments: true } },
      likes: { where: { userId: user.id }, select: { id: true } },
    },
  });

  const items = posts.map((p) => ({
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
  }));

  return NextResponse.json({
    items,
    nextCursor: posts.length === 10 ? posts[posts.length - 1].id : null,
  });
}

const createSchema = z.object({
  text: z.string().trim().min(1, "כתוב משהו").max(2000, "הטקסט ארוך מדי"),
  imageUrl: z.string().optional().nullable(),
  videoUrl: z.string().optional().nullable(),
  audioUrl: z.string().optional().nullable(),
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

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (isBanned(user)) return NextResponse.json({ error: "החשבון שלך מושעה" }, { status: 403 });

  const isAdmin = isAdminUser(user);

  // Video posting needs full access, or a credit bought in the shop -
  // each credit covers exactly one video post.
  if (parsed.data.videoUrl && !isAdmin && !user.hasAccess) {
    const spent = await prisma.user.updateMany({
      where: { id: user.id, postCredits: { gt: 0 } },
      data: { postCredits: { decrement: 1 } },
    });
    if (spent.count === 0) {
      return NextResponse.json(
        { error: "אין לך גישה להעלאת וידאו. אפשר לקנות גישה בחנות." },
        { status: 403 }
      );
    }
  }

  // Content moderation on images (video frames aren't screened). Admins
  // bypass this entirely.
  if (parsed.data.imageUrl && !isAdmin) {
    const { flagged } = await moderateImage(parsed.data.imageUrl);
    if (flagged) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          bannedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
          banReason: "פרסום תוכן לא הולם (עירום/אלימות)",
        },
      });
      return NextResponse.json(
        { error: "התמונה מכילה תוכן לא הולם. החשבון שלך הושעה ל-24 שעות." },
        { status: 403 }
      );
    }
  }

  const post = await prisma.post.create({
    data: {
      authorId: user.id,
      text: parsed.data.text,
      imageUrl: parsed.data.imageUrl || null,
      videoUrl: parsed.data.videoUrl || null,
      audioUrl: parsed.data.audioUrl || null,
      gameCode: parsed.data.gameCode || null,
      gameType: parsed.data.gameType || null,
      gameControls: parsed.data.gameControls || null,
    },
    include: {
      author: { select: { id: true, username: true, avatarUrl: true } },
    },
  });

  return NextResponse.json({
    item: {
      id: post.id,
      text: post.text,
      imageUrl: post.imageUrl,
      videoUrl: post.videoUrl,
      audioUrl: post.audioUrl,
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
