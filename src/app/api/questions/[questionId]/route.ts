import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VOTER_COOKIE } from "@/lib/voter";

type Params = { params: Promise<{ questionId: string }> };

const EDIT_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

// PATCH /api/questions/[questionId] — edit question text (submitter only, within 2 min)
export async function PATCH(req: NextRequest, { params }: Params) {
  const { questionId } = await params;
  const voterId = req.cookies.get(VOTER_COOKIE)?.value;
  if (!voterId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }
  if (question.submitterId !== voterId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  if (Date.now() - question.createdAt.getTime() > EDIT_WINDOW_MS) {
    return NextResponse.json({ error: "Edit window has expired" }, { status: 403 });
  }

  const body = await req.json();
  const text = body?.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "Question text is required" }, { status: 400 });
  }
  if (text.length > 280) {
    return NextResponse.json(
      { error: "Questions must be 280 characters or fewer." },
      { status: 400 }
    );
  }

  const updated = await prisma.question.update({
    where: { id: questionId },
    data: { text },
  });
  return NextResponse.json(updated);
}

// DELETE /api/questions/[questionId] — retract question (submitter only, within 2 min)
export async function DELETE(req: NextRequest, { params }: Params) {
  const { questionId } = await params;
  const voterId = req.cookies.get(VOTER_COOKIE)?.value;
  if (!voterId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }
  if (question.submitterId !== voterId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  if (Date.now() - question.createdAt.getTime() > EDIT_WINDOW_MS) {
    return NextResponse.json({ error: "Retract window has expired" }, { status: 403 });
  }

  await prisma.question.delete({ where: { id: questionId } });
  return NextResponse.json({ success: true });
}
