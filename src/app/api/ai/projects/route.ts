import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isBanned } from "@/lib/auth";

function parseTier(value: string | null): "full" | "junior" {
  return value === "junior" ? "junior" : "full";
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const tier = parseTier(req.nextUrl.searchParams.get("tier"));

  const items = await prisma.aiProject.findMany({
    where: { userId: user.id, tier },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ items });
}

const schema = z.object({
  tier: z.enum(["full", "junior"]).default("full"),
  name: z.string().trim().min(1).max(60).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (isBanned(user)) return NextResponse.json({ error: "החשבון שלך מושעה" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "קלט לא תקין" }, { status: 400 });
  }

  const project = await prisma.aiProject.create({
    data: { userId: user.id, tier: parsed.data.tier, name: parsed.data.name || "פרויקט חדש" },
  });

  return NextResponse.json({ item: project });
}
