import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";

type Params = { params: Promise<{ questionId: string }> };

// POST /api/questions/[questionId]/answer — mark a question as ANSWERED (admin)
export async function POST(req: NextRequest, { params }: Params) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const isAdmin = token ? await verifySessionToken(token) : false;
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { questionId } = await params;

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { id: true, status: true },
  });
  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const updated = await prisma.question.update({
    where: { id: questionId },
    data: { status: "ANSWERED" },
  });

  return NextResponse.json(updated);
}

// DELETE — reopen a question (mark back to OPEN)
export async function DELETE(req: NextRequest, { params }: Params) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const isAdmin = token ? await verifySessionToken(token) : false;
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { questionId } = await params;

  const updated = await prisma.question.update({
    where: { id: questionId },
    data: { status: "OPEN" },
  });

  return NextResponse.json(updated);
}
