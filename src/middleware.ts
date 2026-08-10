import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const PUBLIC_PAGE_PATHS = ["/login", "/signup"];
const PUBLIC_API_PATHS = ["/api/auth/login", "/api/auth/signup", "/api/captcha"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublicPage = PUBLIC_PAGE_PATHS.some((p) => pathname.startsWith(p));
  const isPublicApi = PUBLIC_API_PATHS.some((p) => pathname.startsWith(p));
  const isApi = pathname.startsWith("/api");

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (isPublicPage || isPublicApi) {
    return NextResponse.next();
  }

  if (!session) {
    if (isApi) {
      return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|uploads).*)",
  ],
};
