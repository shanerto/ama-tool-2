import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, SITE_COOKIE, verifySessionToken } from "@/lib/auth";
import { VOTER_COOKIE, generateVoterId } from "@/lib/voter";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Site-wide password protection ───────────────────────────────────────
  const isSiteAuthExempt =
    pathname === "/login" ||
    pathname.startsWith("/api/site-auth");

  if (!isSiteAuthExempt) {
    const siteToken = request.cookies.get(SITE_COOKIE)?.value;
    const siteValid = siteToken ? await verifySessionToken(siteToken) : false;

    if (!siteValid) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── Admin route protection ──────────────────────────────────────────────
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const token = request.cookies.get(ADMIN_COOKIE)?.value;
    const isValid = token ? await verifySessionToken(token) : false;

    if (!isValid) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── Presenter route protection (same auth as admin) ──────────────────────
  if (pathname.startsWith("/presenter")) {
    const token = request.cookies.get(ADMIN_COOKIE)?.value;
    const isValid = token ? await verifySessionToken(token) : false;

    if (!isValid) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── Voter ID cookie injection ────────────────────────────────────────────
  // Ensure every public request has a stable voter ID cookie so we can
  // attribute votes server-side without requiring a login.
  const response = NextResponse.next();

  if (!request.cookies.get(VOTER_COOKIE)) {
    response.cookies.set(VOTER_COOKIE, generateVoterId(), {
      httpOnly: false, // client JS reads it for optimistic UI
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image  (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
