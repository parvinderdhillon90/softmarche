import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeAccountStatus } from "@/lib/accountStatus";

export async function GET(req: Request) {
  const memberId = new URL(req.url).searchParams.get("memberId");

  // If filtering by team member, get their assigned account IDs first
  let allowedIds: string[] | null = null;
  if (memberId) {
    const assignments = await prisma.accountAssignment.findMany({
      where: { teamMemberId: memberId },
      select: { accountId: true },
    });
    allowedIds = assignments.map((a) => a.accountId);
  }

  const accounts = await prisma.account.findMany({
    where: {
      instagramId: { not: null },
      ...(allowedIds !== null ? { id: { in: allowedIds } } : {}),
    },
    select: {
      id: true,
      pageName: true,
      username: true,
      followers: true,
      monthlyPostTarget: true,
      cachedMonthTotal: true,
      cachedMissedDays: true,
      cachedTodayPosted: true,
      cachedScheduled: true,
      cachedSyncMonth: true,
      cachedSyncYear: true,
      lastSyncAt: true,
    },
    orderBy: { pageName: "asc" },
  });

  const result = accounts.map((a) => ({
    ...a,
    status: computeAccountStatus(a),
  }));

  return NextResponse.json(result);
}
