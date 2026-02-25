import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";

type Params = { params: Promise<{ questionId: string }> };

// POST /api/questions/[questionId]/pin — pin question to top (admin)
export async function POST(req: NextRequest, { params }: Params) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const isAdmin = token ? await verifySessionToken(token) : false;
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { questionId } = await params;
  const updated = await prisma.question.update({
    where: { id: questionId },
    data: { pinnedAt: new Date() },
  });
  return NextResponse.json(updated);
}

// DELETE /api/questions/[questionId]/pin — unpin question (admin)
export async function DELETE(req: NextRequest, { params }: Params) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const isAdmin = token ? await verifySessionToken(token) : false;
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { questionId } = await params;
  const updated = await prisma.question.update({
    where: { id: questionId },
    data: { pinnedAt: null },
  });
  return NextResponse.json(updated);
}
