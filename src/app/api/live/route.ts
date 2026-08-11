import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { requireAccess } from "@/lib/requireAccess";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const rooms = await prisma.liveRoom.findMany({
    where: { status: "LIVE" },
    orderBy: { createdAt: "desc" },
    include: { host: { select: { id: true, username: true } } },
  });

  return NextResponse.json({ items: rooms });
}

const schema = z.object({
  title: z.string().trim().min(1, "תן שם ללייב").max(100, "השם ארוך מדי"),
  broadcastMode: z.enum(["webrtc", "rtmp"]).default("webrtc"),
});

export async function POST(req: NextRequest) {
  const { user, error } = await requireAccess();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "קלט לא תקין" }, { status: 400 });
  }

  const existingLive = await prisma.liveRoom.findFirst({
    where: { hostId: user.id, status: "LIVE" },
  });
  if (existingLive) {
    // Same request resubmitted (e.g. double-click) - return the same room
    // instead of creating a duplicate.
    if (existingLive.title === parsed.data.title && existingLive.broadcastMode === parsed.data.broadcastMode) {
      return NextResponse.json({ item: existingLive });
    }
    // Otherwise the host explicitly started a new live (different title or
    // mode) - the old one is stale, so close it out first.
    await prisma.liveRoom.update({
      where: { id: existingLive.id },
      data: { status: "ENDED", endedAt: new Date() },
    });
  }

  const room = await prisma.liveRoom.create({
    data: {
      hostId: user.id,
      title: parsed.data.title,
      status: "LIVE",
      broadcastMode: parsed.data.broadcastMode,
      streamKey: parsed.data.broadcastMode === "rtmp" ? randomBytes(16).toString("hex") : null,
    },
  });

  return NextResponse.json({ item: room });
}
