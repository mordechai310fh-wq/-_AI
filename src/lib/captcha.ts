import crypto from "crypto";

// Stateless math captcha: the answer is embedded (HMAC-signed) in the token
// that's sent to the client, so no server-side captcha storage is needed.
const CAPTCHA_TTL_MS = 5 * 60 * 1000;

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return secret;
}

function sign(data: string) {
  return crypto.createHmac("sha256", getSecret()).update(data).digest("hex");
}

export function generateCaptcha() {
  const a = crypto.randomInt(1, 10);
  const b = crypto.randomInt(1, 10);
  const answer = a + b;
  const exp = Date.now() + CAPTCHA_TTL_MS;
  const payload = `${answer}.${exp}`;
  const signature = sign(payload);
  const token = Buffer.from(`${payload}.${signature}`).toString("base64url");
  return { question: `${a} + ${b} = ?`, token };
}

export function verifyCaptcha(token: string, userAnswer: number): boolean {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [answerStr, expStr, signature] = decoded.split(".");
    const payload = `${answerStr}.${expStr}`;
    const expected = sign(payload);
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return false;
    }
    if (Date.now() > Number(expStr)) return false;
    return Number(answerStr) === userAnswer;
  } catch {
    return false;
  }
}
