import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";
import { VOTER_COOKIE, generateVoterId } from "@/lib/voter";

type Params = { params: Promise<{ eventId: string }> };

// GET /api/events/[eventId]/questions
// Public → OPEN + not hidden; Admin (cookie present) → all
export async function GET(req: NextRequest, { params }: Params) {
  const { eventId } = await params;
  const sortParam = req.nextUrl.searchParams.get("sort"); // "score" | "newest"
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const isAdmin = token ? await verifySessionToken(token) : false;
  // Assign a stable voter ID on first visit so it exists before any vote
  // request fires. Without this, a new user voting on two questions in
  // quick succession would send both requests without a cookie, causing
  // the server to generate two different voter IDs — allowing the same
  // browser to cast two independent votes on the same question.
  const existingVoterId = req.cookies.get(VOTER_COOKIE)?.value;
  const voterId = existingVoterId ?? generateVoterId();
  const isNewVoter = !existingVoterId;

  // Check event exists
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const questions = await prisma.question.findMany({
    where: {
      eventId,
      ...(isAdmin ? {} : { status: "OPEN", isHidden: false }),
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
      isHidden: q.isHidden,
      pinnedAt: q.pinnedAt,
      isOwn: voterId ? q.submitterId === voterId : false,
      createdAt: q.createdAt,
      score,
      myVote,
    };
  });

  // Sort: pinned questions always first, then by score or newest
  if (!sortParam || sortParam === "score") {
    enriched.sort((a, b) => {
      const aPinned = a.pinnedAt ? 1 : 0;
      const bPinned = b.pinnedAt ? 1 : 0;
      if (bPinned !== aPinned) return bPinned - aPinned;
      if (aPinned && bPinned) {
        return new Date(b.pinnedAt!).getTime() - new Date(a.pinnedAt!).getTime();
      }
      return b.score - a.score || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  } else {
    // newest: pinned still float to top, then by createdAt
    enriched.sort((a, b) => {
      const aPinned = a.pinnedAt ? 1 : 0;
      const bPinned = b.pinnedAt ? 1 : 0;
      if (bPinned !== aPinned) return bPinned - aPinned;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  const questionCount = enriched.length;
  const voteCount = questions.reduce((sum, q) => sum + q.votes.length, 0);

  const res = NextResponse.json({
    event: {
      id: event.id,
      title: event.title,
      description: event.description,
      isVotingOpen: event.isVotingOpen,
      startsAt: event.startsAt,
      type: event.type,
      hostName: event.hostName,
    },
    questions: enriched,
    metrics: { questionCount, voteCount },
  });

  if (isNewVoter) {
    res.cookies.set(VOTER_COOKIE, voterId, {
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }

  return res;
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
  const submitterId = req.cookies.get(VOTER_COOKIE)?.value ?? null;

  if (!text) {
    return NextResponse.json({ error: "Question text is required" }, { status: 400 });
  }
  if (text.length > 280) {
    return NextResponse.json(
      { error: "Questions must be 280 characters or fewer." },
      { status: 400 }
    );
  }
  if (!isAnonymous && !submittedName) {
    return NextResponse.json(
      { error: "Name is required when not submitting anonymously" },
      { status: 400 }
    );
  }

  const question = await prisma.question.create({
    data: { eventId, text, isAnonymous, submittedName, submitterId },
  });

  return NextResponse.json(
    { ...question, score: 0, myVote: null, isOwn: true, isHidden: false, pinnedAt: null },
    { status: 201 }
  );
}
