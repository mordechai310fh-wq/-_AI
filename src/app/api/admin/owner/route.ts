import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/requireOwner";

const schema = z.object({
  userId: z.string().min(1),
  isOwner: z.boolean(),
});

export async function POST(req: NextRequest) {
  const { user, error } = await requireOwner();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "קלט לא תקין" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
  if (target.id === user!.id) {
    return NextResponse.json({ error: "לא ניתן לשנות את סטטוס הבעלים של עצמך" }, { status: 400 });
  }

  // Owner status implies full admin + access, and can never be banned.
  const updated = await prisma.user.update({
    where: { id: target.id },
    data: parsed.data.isOwner
      ? { isOwner: true, role: "ADMIN", hasAccess: true, bannedUntil: null, banReason: null }
      : { isOwner: false },
  });

  return NextResponse.json({
    item: { id: updated.id, username: updated.username, isOwner: updated.isOwner },
  });
}
