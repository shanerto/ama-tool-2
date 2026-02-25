import { NextRequest, NextResponse } from "next/server";
import { verifySitePassword, createSessionToken, SITE_COOKIE } from "@/lib/auth";

// POST /api/site-auth
export async function POST(req: NextRequest) {
  const body = await req.json();
  const password = body?.password;

  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  let isValid: boolean;
  try {
    isValid = verifySitePassword(password);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!isValid) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });

  res.cookies.set(SITE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });

  return res;
}
