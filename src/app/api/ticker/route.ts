import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/ticker — top questions across all active open events
export async function GET() {
  const questions = await prisma.question.findMany({
    where: {
      status: "OPEN",
      isHidden: false,
      event: { isActive: true },
    },
    include: {
      votes: { select: { value: true } },
    },
    take: 50,
  });

  const items = questions
    .map((q) => ({
      text: q.text,
      eventId: q.eventId,
      score: q.votes.reduce((sum, v) => sum + v.value, 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map(({ text, eventId }) => ({ text, eventId }));

  return NextResponse.json({ items });
}
