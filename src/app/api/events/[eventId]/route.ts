import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ eventId: string }> };

// PATCH /api/events/[eventId] — update a team event (no admin auth, guest-managed)
// Body: { title, startsAt, hostName, description?, isVotingOpen? }
export async function PATCH(req: NextRequest, { params }: Params) {
  const { eventId } = await params;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  if (event.type !== "team") {
    return NextResponse.json({ error: "Only team events can be edited here" }, { status: 403 });
  }

  const body = await req.json();
  const { title, startsAt, hostName, description, isVotingOpen, status } = body;

  // Allow a close-only PATCH (no other fields required)
  if (status === "CLOSED") {
    const updated = await prisma.event.update({
      where: { id: eventId },
      data: { status: "CLOSED" },
    });
    return NextResponse.json(updated);
  }

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!startsAt) {
    return NextResponse.json({ error: "Date/time is required" }, { status: 400 });
  }
  const startsAtDate = new Date(startsAt);
  if (isNaN(startsAtDate.getTime())) {
    return NextResponse.json({ error: "Invalid date/time" }, { status: 400 });
  }
  if (!hostName?.trim()) {
    return NextResponse.json({ error: "Host name is required for team events" }, { status: 400 });
  }

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      title: title.trim(),
      startsAt: startsAtDate,
      hostName: hostName.trim(),
      description: description?.trim() || null,
      ...(typeof isVotingOpen === "boolean" ? { isVotingOpen } : {}),
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/events/[eventId] — delete a team event (no admin auth, guest-managed)
// Cascade delete is configured in schema: questions → onDelete: Cascade, votes → onDelete: Cascade
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { eventId } = await params;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  if (event.type !== "team") {
    return NextResponse.json({ error: "Only team events can be deleted here" }, { status: 403 });
  }

  await prisma.event.delete({ where: { id: eventId } });
  return NextResponse.json({ success: true });
}
