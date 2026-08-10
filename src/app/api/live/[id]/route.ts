import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const { id } = await params;
  const room = await prisma.liveRoom.findUnique({
    where: { id },
    include: { host: { select: { id: true, username: true } } },
  });

  if (!room) return NextResponse.json({ error: "הלייב לא נמצא" }, { status: 404 });

  return NextResponse.json({ item: room });
}
