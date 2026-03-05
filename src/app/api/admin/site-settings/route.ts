import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";

// GET /api/admin/site-settings — returns all site settings as a key/value object
export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const isAdmin = token ? await verifySessionToken(token) : false;
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.siteSetting.findMany();
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return NextResponse.json(settings);
}

// PATCH /api/admin/site-settings — upserts a setting { key, value }
export async function PATCH(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const isAdmin = token ? await verifySessionToken(token) : false;
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { key, value } = body;

  if (typeof key !== "string" || typeof value !== "string") {
    return NextResponse.json({ error: "key and value must be strings" }, { status: 400 });
  }

  const setting = await prisma.siteSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });

  return NextResponse.json(setting);
}
