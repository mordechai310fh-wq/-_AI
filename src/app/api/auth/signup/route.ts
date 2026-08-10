import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { signSession, SESSION_COOKIE } from "@/lib/session";
import { verifyCaptcha } from "@/lib/captcha";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const schema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "שם המשתמש קצר מדי")
    .max(20, "שם המשתמש ארוך מדי")
    .regex(/^\S+$/, "שם משתמש לא יכול להכיל רווחים"),
  password: z.string().min(6, "הסיסמה חייבת להכיל לפחות 6 תווים"),
  captchaToken: z.string(),
  captchaAnswer: z.coerce.number(),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`signup:${ip}`, 5, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "יותר מדי ניסיונות, נסה שוב מאוחר יותר" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "קלט לא תקין" }, { status: 400 });
  }

  const { username, password, captchaToken, captchaAnswer } = parsed.data;

  if (!verifyCaptcha(captchaToken, captchaAnswer)) {
    return NextResponse.json({ error: "אימות אבטחה שגוי, נסה שוב" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: "שם המשתמש כבר תפוס" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { username, passwordHash, role: "USER" },
  });

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
