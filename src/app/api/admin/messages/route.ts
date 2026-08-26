import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";

const schema = z.object({
  targetUserId: z.string().min(1).nullable(),
  text: z.string().trim().min(1, "כתוב הודעה").max(1000, "ההודעה ארוכה מדי"),
});

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "קלט לא תקין" }, { status: 400 });
  }

  if (parsed.data.targetUserId) {
    const target = await prisma.user.findUnique({ where: { id: parsed.data.targetUserId } });
    if (!target) return NextResponse.json({ error: "המשתמש לא נמצא" }, { status: 404 });
  }

  const message = await prisma.adminMessage.create({
    data: { targetUserId: parsed.data.targetUserId, text: parsed.data.text },
  });

  return NextResponse.json({ item: message });
}
