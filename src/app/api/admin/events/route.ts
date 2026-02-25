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

// PATCH /api/admin/events — toggle event active status
// Body: { id, isActive }
export async function PATCH(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const isAdmin = token ? await verifySessionToken(token) : false;
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, isActive, isVotingOpen } = body;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  if (typeof isActive !== "boolean" && typeof isVotingOpen !== "boolean") {
    return NextResponse.json(
      { error: "isActive or isVotingOpen (boolean) is required" },
      { status: 400 }
    );
  }

  const data: { isActive?: boolean; isVotingOpen?: boolean } = {};
  if (typeof isActive === "boolean") data.isActive = isActive;
  if (typeof isVotingOpen === "boolean") data.isVotingOpen = isVotingOpen;

  const event = await prisma.event.update({ where: { id }, data });
  return NextResponse.json(event);
}
