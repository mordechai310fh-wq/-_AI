import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const since = user.lastSeenMessageAt ?? new Date(0);

  const messages = await prisma.adminMessage.findMany({
    where: {
      createdAt: { gt: since },
      OR: [{ targetUserId: null }, { targetUserId: user.id }],
    },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  return NextResponse.json({ items: messages });
}
