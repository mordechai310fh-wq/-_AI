import { SignJWT, jwtVerify } from "jose";

// Edge-safe: no Prisma, no next/headers. Used by middleware AND server code.
export const SESSION_COOKIE = "mgv_session";

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  sub: string;
  username: string;
  role: string;
};

export async function signSession(payload: SessionPayload, expiresIn: string = "30d") {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.sub === "string" &&
      typeof payload.username === "string" &&
      typeof payload.role === "string"
    ) {
      return { sub: payload.sub, username: payload.username, role: payload.role };
    }
    return null;
  } catch {
    return null;
  }
}
