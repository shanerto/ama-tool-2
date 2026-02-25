import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";
import { VOTER_COOKIE } from "@/lib/voter";

type Params = { params: Promise<{ eventId: string }> };

// GET /api/events/[eventId]/questions
// Public → OPEN only; Admin (cookie present) → OPEN + ANSWERED
export async function GET(req: NextRequest, { params }: Params) {
  const { eventId } = await params;
  const sortParam = req.nextUrl.searchParams.get("sort"); // "score" | "newest"
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const isAdmin = token ? await verifySessionToken(token) : false;
  const voterId = req.cookies.get(VOTER_COOKIE)?.value ?? null;

  // Check event exists
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const questions = await prisma.question.findMany({
    where: {
      eventId,
      ...(isAdmin ? {} : { status: "OPEN" }),
    },
    include: {
      votes: {
        select: { voterId: true, value: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Compute scores and caller's current vote
  const enriched = questions.map((q) => {
    const score = q.votes.reduce((sum, v) => sum + v.value, 0);
    const myVote = voterId
      ? (q.votes.find((v) => v.voterId === voterId)?.value ?? null)
      : null;
    return {
      id: q.id,
      eventId: q.eventId,
      text: q.text,
      submittedName: q.isAnonymous ? null : q.submittedName,
      isAnonymous: q.isAnonymous,
      status: q.status,
      createdAt: q.createdAt,
      score,
      myVote,
    };
  });

  // Sort
  if (!sortParam || sortParam === "score") {
    enriched.sort((a, b) => b.score - a.score || b.createdAt.getTime() - a.createdAt.getTime());
  }
  // "newest" keeps the default orderBy: createdAt desc from Prisma

  return NextResponse.json({ event, questions: enriched });
}

// POST /api/events/[eventId]/questions — submit a question (public)
export async function POST(req: NextRequest, { params }: Params) {
  const { eventId } = await params;

  const event = await prisma.event.findUnique({ where: { id: eventId, isActive: true } });
  if (!event) {
    return NextResponse.json({ error: "Event not found or inactive" }, { status: 404 });
  }

  const body = await req.json();
  const text = body?.text?.trim();
  const isAnonymous: boolean = body?.isAnonymous === true;
  const submittedName = isAnonymous ? null : body?.submittedName?.trim() || null;

  if (!text) {
    return NextResponse.json({ error: "Question text is required" }, { status: 400 });
  }
  if (!isAnonymous && !submittedName) {
    return NextResponse.json(
      { error: "Name is required when not submitting anonymously" },
      { status: 400 }
    );
  }

  const question = await prisma.question.create({
    data: { eventId, text, isAnonymous, submittedName },
  });

  return NextResponse.json({ ...question, score: 0, myVote: null }, { status: 201 });
}
