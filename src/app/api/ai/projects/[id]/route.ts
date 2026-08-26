import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const { id } = await params;
  const project = await prisma.aiProject.findUnique({ where: { id } });
  if (!project || project.userId !== user.id) {
    return NextResponse.json({ error: "הפרויקט לא נמצא" }, { status: 404 });
  }

  await prisma.aiProject.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
