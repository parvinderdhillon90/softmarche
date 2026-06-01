import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFacebookPostInsights, getInstagramPostInsights } from "@/lib/meta";

// Refresh analytics — optionally scoped to one account
export async function POST(req: Request) {
  const body = req.headers.get("content-type")?.includes("application/json")
    ? await req.json().catch(() => ({}))
    : {};
  const accountId = body.accountId as string | undefined;

  const published = await prisma.post.findMany({
    where: {
      status: "PUBLISHED",
      externalId: { not: null },
      ...(accountId ? { accountId } : {}),
    },
    include: { account: true },
  });

  const results = await Promise.allSettled(
    published.map(async (post) => {
      const metrics =
        post.platform === "FACEBOOK"
          ? await getFacebookPostInsights(post.externalId!, post.account.accessToken)
          : await getInstagramPostInsights(post.externalId!, post.account.accessToken);

      return prisma.analytics.upsert({
        where: { postId: post.id },
        create: {
          postId: post.id,
          impressions: metrics["post_impressions"] ?? metrics["impressions"] ?? 0,
          reach: metrics["post_impressions_unique"] ?? metrics["reach"] ?? 0,
          likes: metrics["post_reactions_by_type_total"] ?? metrics["likes"] ?? 0,
          comments: metrics["comments"] ?? 0,
          shares: metrics["shares"] ?? 0,
          saves: metrics["saves"] ?? 0,
          clicks: metrics["post_clicks"] ?? metrics["clicks"] ?? 0,
        },
        update: {
          impressions: metrics["post_impressions"] ?? metrics["impressions"] ?? 0,
          reach: metrics["post_impressions_unique"] ?? metrics["reach"] ?? 0,
          likes: metrics["post_reactions_by_type_total"] ?? metrics["likes"] ?? 0,
          comments: metrics["comments"] ?? 0,
          shares: metrics["shares"] ?? 0,
          saves: metrics["saves"] ?? 0,
          clicks: metrics["post_clicks"] ?? metrics["clicks"] ?? 0,
          fetchedAt: new Date(),
        },
      });
    })
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  return NextResponse.json({ refreshed: succeeded, total: published.length });
}

// Aggregate analytics — filterable by account and platform
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform");
  const accountId = searchParams.get("accountId");
  const days = parseInt(searchParams.get("days") ?? "30");

  const since = new Date();
  since.setDate(since.getDate() - days);

  const posts = await prisma.post.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: { gte: since },
      ...(platform ? { platform: platform as "FACEBOOK" | "INSTAGRAM" } : {}),
      ...(accountId ? { accountId } : {}),
    },
    include: {
      analytics: true,
      account: { select: { pageName: true, platform: true } },
    },
    orderBy: { publishedAt: "asc" },
  });

  const totals = posts.reduce(
    (acc, p) => {
      if (!p.analytics) return acc;
      acc.impressions += p.analytics.impressions;
      acc.reach += p.analytics.reach;
      acc.likes += p.analytics.likes;
      acc.comments += p.analytics.comments;
      acc.shares += p.analytics.shares;
      acc.saves += p.analytics.saves;
      acc.clicks += p.analytics.clicks;
      return acc;
    },
    { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0 }
  );

  return NextResponse.json({ totals, posts, postCount: posts.length });
}
