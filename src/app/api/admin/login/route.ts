import { NextRequest, NextResponse } from "next/server";
import {
  verifyAdminPassword,
  createSessionToken,
  ADMIN_COOKIE,
} from "@/lib/auth";

// POST /api/admin/login
export async function POST(req: NextRequest) {
  const body = await req.json();
  const password = body?.password;

  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  let isValid: boolean;
  try {
    isValid = verifyAdminPassword(password);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!isValid) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });

  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 8, // 8 hours
    path: "/",
    // secure: true is set automatically in production by Next.js when served over HTTPS
  });

  return res;
}
