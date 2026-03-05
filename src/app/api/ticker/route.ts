import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/ticker — top questions across all active open events
export async function GET() {
  // Check global tickerEnabled setting (default: true)
  let tickerEnabled = true;
  try {
    const tickerSetting = await prisma.siteSetting.findUnique({
      where: { key: "tickerEnabled" },
    });
    tickerEnabled = tickerSetting ? tickerSetting.value === "true" : true;
  } catch {
    // If the settings table doesn't exist yet, default to enabled
  }

  if (!tickerEnabled) {
    return NextResponse.json({ items: [] });
  }

  const questions = await prisma.question.findMany({
    where: {
      status: "OPEN",
      isHidden: false,
      event: { isActive: true, isPublic: true },
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
