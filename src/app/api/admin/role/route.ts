import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";

const schema = z.object({
  userId: z.string().min(1),
  role: z.enum(["ADMIN", "USER"]),
});

export async function POST(req: NextRequest) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "קלט לא תקין" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
  if (target.isOwner) {
    return NextResponse.json({ error: "לא ניתן לשנות את הרשאות חשבון הבעלים" }, { status: 403 });
  }
  if (target.id === user!.id) {
    return NextResponse.json({ error: "לא ניתן לשנות את ההרשאות של עצמך" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { role: parsed.data.role },
  });

  return NextResponse.json({ item: { id: updated.id, username: updated.username, role: updated.role } });
}
