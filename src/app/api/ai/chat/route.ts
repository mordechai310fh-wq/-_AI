import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isBanned } from "@/lib/auth";
import { askAi, askJuniorAi } from "@/lib/groq";

const HISTORY_LIMIT = 20;

function parseTier(value: string | null): "full" | "junior" {
  return value === "junior" ? "junior" : "full";
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const tier = parseTier(req.nextUrl.searchParams.get("tier"));
  const projectId = req.nextUrl.searchParams.get("projectId");

  const messages = await prisma.aiMessage.findMany({
    where: { userId: user.id, tier, projectId: projectId || null },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return NextResponse.json({ items: messages });
}

const schema = z.object({
  message: z.string().trim().min(1).max(4000),
  tier: z.enum(["full", "junior"]).default("full"),
  projectId: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (isBanned(user)) return NextResponse.json({ error: "החשבון שלך מושעה" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "קלט לא תקין" }, { status: 400 });
  }

  const { tier } = parsed.data;
  const projectId = parsed.data.projectId || null;

  if (projectId) {
    const project = await prisma.aiProject.findUnique({ where: { id: projectId } });
    if (!project || project.userId !== user.id || project.tier !== tier) {
      return NextResponse.json({ error: "הפרויקט לא נמצא" }, { status: 404 });
    }
  }

  if (tier === "full") {
    if (!user.isOwner && !user.hasAccess) {
      return NextResponse.json(
        { error: "אין לך גישה מלאה למגניב. אפשר לקנות מגניב ג'וניור בחנות." },
        { status: 403 }
      );
    }
  } else {
    // מגניב ג'וניור - separate limited chat, paid for with credits bought
    // in the shop, consumed per message.
    const spent = await prisma.user.updateMany({
      where: { id: user.id, juniorChatCredits: { gt: 0 } },
      data: { juniorChatCredits: { decrement: 1 } },
    });
    if (spent.count === 0) {
      return NextResponse.json(
        { error: "נגמרו לך ההודעות של מגניב ג'וניור. אפשר לקנות עוד בחנות." },
        { status: 403 }
      );
    }
  }

  const userMessage = await prisma.aiMessage.create({
    data: { userId: user.id, role: "user", content: parsed.data.message, tier, projectId },
  });

  const recent = await prisma.aiMessage.findMany({
    where: { userId: user.id, tier, projectId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
  });
  const history = recent
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  let replyText: string;
  try {
    replyText = tier === "junior" ? await askJuniorAi(history) : await askAi(history);
  } catch (err) {
    console.error("Groq AI error:", err);
    return NextResponse.json({ error: "מגניב לא זמין כרגע, נסה שוב מאוחר יותר" }, { status: 502 });
  }

  const assistantMessage = await prisma.aiMessage.create({
    data: { userId: user.id, role: "assistant", content: replyText, tier, projectId },
  });

  if (projectId) {
    await prisma.aiProject.update({ where: { id: projectId }, data: { updatedAt: new Date() } });
  }

  return NextResponse.json({ userMessage, assistantMessage });
}
