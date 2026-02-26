import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";
import { VOTER_COOKIE } from "@/lib/voter";

// GET /api/events — list all active events (public)
export async function GET() {
  const events = await prisma.event.findMany({
    where: { isActive: true },
    orderBy: { startsAt: "asc" },
    select: { id: true, title: true, description: true, startsAt: true, createdAt: true, type: true, hostName: true },
  });
  return NextResponse.json(events);
}

// POST /api/events — create a new event
// Admins can create company or team events.
// Non-admins can create team events only.
export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const isAdmin = token ? await verifySessionToken(token) : false;
  const createdByUserId = req.cookies.get(VOTER_COOKIE)?.value ?? null;

  const body = await req.json();
  const title = body?.title?.trim();
  const description = body?.description?.trim() || null;
  const startsAtRaw = body?.startsAt;
  const type: "company" | "team" = body?.type === "company" ? "company" : "team";
  const hostName = body?.hostName?.trim() || null;

  // Server-side enforcement: non-admins cannot create company events
  if (!isAdmin && type === "company") {
    return NextResponse.json({ error: "Only admins can create company events" }, { status: 403 });
  }

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

  // Team events require a host name
  if (type === "team" && !hostName) {
    return NextResponse.json({ error: "Host name is required for team events" }, { status: 400 });
  }

  const event = await prisma.event.create({
    data: {
      title,
      description,
      startsAt,
      type,
      hostName: type === "team" ? hostName : null,
      createdByUserId,
    },
  });
  return NextResponse.json(event, { status: 201 });
}
