import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { SESSION_COOKIE, verifySession } from "./session";

export { SESSION_COOKIE, signSession, verifySession } from "./session";
export type { SessionPayload } from "./session";

// Server components / route handlers (Node runtime): reads fresh user data from DB.
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await verifySession(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) return null;

  return user;
}

export function isBanned(user: { bannedUntil: Date | null }) {
  return !!user.bannedUntil && user.bannedUntil.getTime() > Date.now();
}
