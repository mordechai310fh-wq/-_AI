import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      username: true,
      role: true,
      isOwner: true,
      hasAccess: true,
      bannedUntil: true,
      banReason: true,
      coins: true,
      postCredits: true,
      juniorChatCredits: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ items: users });
}
