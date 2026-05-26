import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeAccountStatus } from "@/lib/accountStatus";

export async function GET() {
  const accounts = await prisma.account.findMany({
    where: { instagramId: { not: null } },
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
