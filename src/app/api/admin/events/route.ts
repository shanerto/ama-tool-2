import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";

// GET /api/admin/events — list ALL events including inactive (admin)
export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const isAdmin = token ? await verifySessionToken(token) : false;
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const events = await prisma.event.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { questions: true } },
    },
  });
  return NextResponse.json(events);
}

// PATCH /api/admin/events — update event fields (admin)
// Body: { id, isActive?, isVotingOpen?, title?, description?, startsAt? }
export async function PATCH(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const isAdmin = token ? await verifySessionToken(token) : false;
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, isActive, isVotingOpen, title, description, startsAt } = body;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const data: {
    isActive?: boolean;
    isVotingOpen?: boolean;
    title?: string;
    description?: string | null;
    startsAt?: Date | null;
  } = {};

  if (typeof isActive === "boolean") data.isActive = isActive;
  if (typeof isVotingOpen === "boolean") data.isVotingOpen = isVotingOpen;
  if (typeof title === "string" && title.trim()) data.title = title.trim();
  if ("description" in body) data.description = description?.trim() || null;
  if ("startsAt" in body) data.startsAt = startsAt ? new Date(startsAt) : null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const event = await prisma.event.update({ where: { id }, data });
  return NextResponse.json(event);
}

// DELETE /api/admin/events — permanently delete an event (admin)
// Body: { id }
export async function DELETE(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const isAdmin = token ? await verifySessionToken(token) : false;
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await prisma.event.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
