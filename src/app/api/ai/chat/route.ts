import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isBanned } from "@/lib/auth";
import { askAi } from "@/lib/groq";

const HISTORY_LIMIT = 20;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const messages = await prisma.aiMessage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return NextResponse.json({ items: messages });
}

const schema = z.object({
  message: z.string().trim().min(1).max(4000),
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

  // Full access (owner/granted) chats freely. Everyone else needs a
  // מגניב ג'וניור credit bought in the shop, consumed per message.
  if (!user.isOwner && !user.hasAccess) {
    const spent = await prisma.user.updateMany({
      where: { id: user.id, juniorChatCredits: { gt: 0 } },
      data: { juniorChatCredits: { decrement: 1 } },
    });
    if (spent.count === 0) {
      return NextResponse.json(
        { error: "אין לך גישה לצ'אט עם מגניב. אפשר לקנות מגניב ג'וניור בחנות." },
        { status: 403 }
      );
    }
  }

  const userMessage = await prisma.aiMessage.create({
    data: { userId: user.id, role: "user", content: parsed.data.message },
  });

  const recent = await prisma.aiMessage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
  });
  const history = recent
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  let replyText: string;
  try {
    replyText = await askAi(history);
  } catch (err) {
    console.error("Groq AI error:", err);
    return NextResponse.json({ error: "מגניב לא זמין כרגע, נסה שוב מאוחר יותר" }, { status: 502 });
  }

  const assistantMessage = await prisma.aiMessage.create({
    data: { userId: user.id, role: "assistant", content: replyText },
  });

  return NextResponse.json({ userMessage, assistantMessage });
}
