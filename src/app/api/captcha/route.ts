import { NextResponse } from "next/server";
import { generateCaptcha } from "@/lib/captcha";

export async function GET() {
  const { question, token } = generateCaptcha();
  return NextResponse.json({ question, token });
}
