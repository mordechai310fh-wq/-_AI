import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { signSession, SESSION_COOKIE } from "@/lib/session";
import { verifyCaptcha } from "@/lib/captcha";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const schema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
  captchaToken: z.string(),
  captchaAnswer: z.coerce.number(),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`login:${ip}`, 8, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "יותר מדי ניסיונות התחברות, נסה שוב בעוד כמה דקות" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "קלט לא תקין" }, { status: 400 });
  }

  const { username, password, captchaToken, captchaAnswer } = parsed.data;

  if (!verifyCaptcha(captchaToken, captchaAnswer)) {
    return NextResponse.json({ error: "אימות אבטחה שגוי, נסה שוב" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return NextResponse.json({ error: "שם משתמש או סיסמה שגויים" }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "שם משתמש או סיסמה שגויים" }, { status: 401 });
  }

  const token = await signSession({ sub: user.id, username: user.username, role: user.role });

  const res = NextResponse.json({
    user: { id: user.id, username: user.username, role: user.role },
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
