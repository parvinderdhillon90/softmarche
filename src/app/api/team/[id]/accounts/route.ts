import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Replace all assignments for a team member
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { accountIds } = await req.json() as { accountIds: string[] };

  await prisma.$transaction([
    prisma.accountAssignment.deleteMany({ where: { teamMemberId: id } }),
    prisma.accountAssignment.createMany({
      data: accountIds.map((accountId) => ({ teamMemberId: id, accountId })),
      skipDuplicates: true,
    }),
  ]);

  return NextResponse.json({ ok: true, assigned: accountIds.length });
}
