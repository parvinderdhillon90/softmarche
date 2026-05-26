import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PostStatus, Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // YYYY-MM
  const status = searchParams.get("status") as PostStatus | null;

  const where: Prisma.PostWhereInput = {};

  if (month) {
    const start = new Date(`${month}-01`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    where.scheduledAt = { gte: start, lt: end };
  }

  if (status) where.status = status;

  const posts = await prisma.post.findMany({
    where,
    include: { account: { select: { pageName: true, platform: true } }, analytics: true },
    orderBy: { scheduledAt: "asc" },
  });

  return NextResponse.json(posts);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { accountId, platform, caption, mediaUrls, mediaType, scheduledAt } = body;

  const post = await prisma.post.create({
    data: {
      accountId,
      platform,
      caption,
      mediaUrls: mediaUrls ?? [],
      mediaType: mediaType ?? "IMAGE",
      status: scheduledAt ? PostStatus.SCHEDULED : PostStatus.DRAFT,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    },
  });

  return NextResponse.json(post, { status: 201 });
}
