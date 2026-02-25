import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VOTER_COOKIE, generateVoterId } from "@/lib/voter";

type Params = { params: Promise<{ questionId: string }> };

// POST /api/questions/[questionId]/vote
// Body: { value: 1 | -1 | 0 }  (0 = remove vote)
export async function POST(req: NextRequest, { params }: Params) {
  const { questionId } = await params;

  // Resolve or create voter ID
  let voterId = req.cookies.get(VOTER_COOKIE)?.value;
  const isNewVoter = !voterId;
  if (!voterId) voterId = generateVoterId();

  const body = await req.json();
  const raw = body?.value;
  if (raw !== 1 && raw !== -1 && raw !== 0) {
    return NextResponse.json(
      { error: "value must be 1, -1, or 0" },
      { status: 400 }
    );
  }
  const value: number = raw;

  // Check question exists and is OPEN
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { id: true, status: true, eventId: true },
  });
  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }
  if (question.status !== "OPEN") {
    return NextResponse.json(
      { error: "Cannot vote on an answered question" },
      { status: 409 }
    );
  }

  if (value === 0) {
    // Remove vote
    await prisma.vote.deleteMany({ where: { questionId, voterId } });
  } else {
    // Upsert — DB unique constraint prevents duplicates
    await prisma.vote.upsert({
      where: { questionId_voterId: { questionId, voterId } },
      create: { questionId, voterId, value },
      update: { value },
    });
  }

  // Return updated score
  const agg = await prisma.vote.aggregate({
    where: { questionId },
    _sum: { value: true },
  });
  const score = agg._sum.value ?? 0;

  const res = NextResponse.json({ score, myVote: value === 0 ? null : value });

  // Persist voter ID in cookie if it was just created
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
