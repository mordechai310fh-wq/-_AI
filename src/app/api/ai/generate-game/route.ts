import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/requireAccess";
import { generateGame } from "@/lib/groq";
import { checkRateLimit } from "@/lib/rateLimit";

const schema = z.object({
  prompt: z.string().trim().min(3, "תאר את המשחק בכמה מילים").max(500, "התיאור ארוך מדי"),
});

export async function POST(req: NextRequest) {
  const { user, error } = await requireAccess();
  if (error) return error;

  const rl = checkRateLimit(`generate-game:${user.id}`, 10, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "יותר מדי בקשות ליצירת משחקים, נסה שוב בעוד כמה דקות" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "קלט לא תקין" }, { status: 400 });
  }

  try {
    const { code, controls } = await generateGame(parsed.data.prompt);
    return NextResponse.json({ code, controls });
  } catch (err) {
    console.error("generate-game error:", err);
    const status = (err as { status?: number })?.status;
    if (status === 429) {
      return NextResponse.json(
        { error: "מגניב עמוס כרגע (הגבלת קצב של Groq), נסה שוב בעוד דקה" },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: "מגניב לא הצליח ליצור את המשחק, נסה שוב" }, { status: 502 });
  }
}
