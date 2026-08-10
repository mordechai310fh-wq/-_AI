import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";

const schema = z.object({
  userId: z.string().min(1),
  hours: z.coerce.number().positive().max(24 * 365 * 10), // cap at 10 years
  reason: z.string().trim().max(300).optional(),
});

export async function POST(req: NextRequest) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "קלט לא תקין" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
  if (target.isOwner) {
    return NextResponse.json({ error: "לא ניתן לחסום את חשבון הבעלים" }, { status: 403 });
  }
  if (target.id === user!.id) {
    return NextResponse.json({ error: "לא ניתן לחסום את עצמך" }, { status: 400 });
  }

  const bannedUntil = new Date(Date.now() + parsed.data.hours * 60 * 60 * 1000);

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { bannedUntil, banReason: parsed.data.reason || null },
  });

  return NextResponse.json({
    item: {
      id: updated.id,
      username: updated.username,
      bannedUntil: updated.bannedUntil,
      banReason: updated.banReason,
    },
  });
}
