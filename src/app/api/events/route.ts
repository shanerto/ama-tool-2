import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";

// GET /api/events — list all active events (public)
export async function GET() {
  const events = await prisma.event.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, description: true, startsAt: true, createdAt: true },
  });
  return NextResponse.json(events);
}

// POST /api/events — create a new event (admin only)
export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const isAdmin = token ? await verifySessionToken(token) : false;
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const title = body?.title?.trim();
  const description = body?.description?.trim() || null;
  const startsAtRaw = body?.startsAt;

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!startsAtRaw) {
    return NextResponse.json({ error: "Event date/time is required" }, { status: 400 });
  }
  const startsAt = new Date(startsAtRaw);
  if (isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: "Invalid event date/time" }, { status: 400 });
  }

  const event = await prisma.event.create({
    data: { title, description, startsAt },
  });
  return NextResponse.json(event, { status: 201 });
}
