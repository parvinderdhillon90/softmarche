import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFacebookPostInsights, getInstagramPostInsights } from "@/lib/meta";

function periodRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return { start, end };
}

function prevMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function sumMetrics(posts: Array<{ analytics: { impressions: number; reach: number; likes: number; comments: number; shares: number; saves: number; clicks: number } | null }>) {
  return posts.reduce(
    (acc, p) => {
      if (!p.analytics) return acc;
      acc.impressions += p.analytics.impressions;
      acc.reach       += p.analytics.reach;
      acc.likes       += p.analytics.likes;
      acc.comments    += p.analytics.comments;
      acc.shares      += p.analytics.shares;
      acc.saves       += p.analytics.saves;
      acc.clicks      += p.analytics.clicks;
      return acc;
    },
    { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0 }
  );
}

// Refresh analytics for all published posts of an account
export async function POST(req: Request) {
  const { accountId } = await req.json();
  if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });

  const published = await prisma.post.findMany({
    where: { accountId, status: "PUBLISHED", externalId: { not: null } },
    include: { account: true },
  });

  await Promise.allSettled(
    published.map(async (post) => {
      try {
        const metrics =
          post.platform === "FACEBOOK"
            ? await getFacebookPostInsights(post.externalId!, post.account.accessToken)
            : await getInstagramPostInsights(post.externalId!, post.account.accessToken);

        return prisma.analytics.upsert({
          where: { postId: post.id },
          create: {
            postId: post.id,
            impressions: metrics["post_impressions"] ?? metrics["impressions"] ?? 0,
            reach:       metrics["post_impressions_unique"] ?? metrics["reach"] ?? 0,
            likes:       metrics["post_reactions_by_type_total"] ?? metrics["likes"] ?? 0,
            comments:    metrics["comments"] ?? 0,
            shares:      metrics["shares"] ?? 0,
            saves:       metrics["saves"] ?? 0,
            clicks:      metrics["post_clicks"] ?? metrics["clicks"] ?? 0,
          },
          update: {
            impressions: metrics["post_impressions"] ?? metrics["impressions"] ?? 0,
            reach:       metrics["post_impressions_unique"] ?? metrics["reach"] ?? 0,
            likes:       metrics["post_reactions_by_type_total"] ?? metrics["likes"] ?? 0,
            comments:    metrics["comments"] ?? 0,
            shares:      metrics["shares"] ?? 0,
            saves:       metrics["saves"] ?? 0,
            clicks:      metrics["post_clicks"] ?? metrics["clicks"] ?? 0,
            fetchedAt:   new Date(),
          },
        });
      } catch {
        // skip posts whose insights aren't available yet
      }
    })
  );

  return NextResponse.json({ ok: true, refreshed: published.length });
}

// Full analytics report with last-month comparison
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  const { year: prevYear, month: prevMonthNum } = prevMonth(curYear, curMonth);

  const cur  = periodRange(curYear, curMonth);
  const prev = periodRange(prevYear, prevMonthNum);

  // Fetch current + previous month posts in parallel
  const [account, curPosts, prevPosts] = await Promise.all([
    prisma.account.findUnique({
      where: { id: accountId },
      select: { followers: true, cachedStoriesCount: true, pageName: true, username: true },
    }),
    prisma.post.findMany({
      where: { accountId, status: "PUBLISHED", publishedAt: { gte: cur.start, lt: cur.end } },
      include: { analytics: true },
      orderBy: { publishedAt: "asc" },
    }),
    prisma.post.findMany({
      where: { accountId, status: "PUBLISHED", publishedAt: { gte: prev.start, lt: prev.end } },
      include: { analytics: true },
    }),
  ]);

  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  // Follower snapshot from ~30 days ago
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const oldSnapshot = await prisma.followerSnapshot.findFirst({
    where: { accountId, date: { lte: thirtyDaysAgo } },
    orderBy: { date: "desc" },
  });

  const followerChange = oldSnapshot ? account.followers - oldSnapshot.followers : null;

  // Post type breakdown
  const breakdown = (posts: typeof curPosts) => ({
    total:    posts.length,
    reels:    posts.filter((p) => p.mediaType === "REEL").length,
    static:   posts.filter((p) => p.mediaType === "IMAGE").length,
    carousel: posts.filter((p) => p.mediaType === "CAROUSEL").length,
    video:    posts.filter((p) => p.mediaType === "VIDEO").length,
  });

  const curMetrics  = sumMetrics(curPosts);
  const prevMetrics = sumMetrics(prevPosts);

  // Engagement rate = (likes + comments + shares + saves) / reach * 100
  const engagementRate = (m: typeof curMetrics) =>
    m.reach > 0 ? +((( m.likes + m.comments + m.shares + m.saves) / m.reach) * 100).toFixed(2) : 0;

  // Top 5 posts by impressions
  const topPosts = [...curPosts]
    .filter((p) => p.analytics)
    .sort((a, b) => (b.analytics?.impressions ?? 0) - (a.analytics?.impressions ?? 0))
    .slice(0, 5)
    .map((p) => ({
      id:          p.id,
      caption:     p.caption.slice(0, 100),
      mediaType:   p.mediaType,
      publishedAt: p.publishedAt,
      mediaUrl:    p.mediaUrls[0] ?? null,
      impressions: p.analytics?.impressions ?? 0,
      reach:       p.analytics?.reach ?? 0,
      likes:       p.analytics?.likes ?? 0,
      comments:    p.analytics?.comments ?? 0,
      shares:      p.analytics?.shares ?? 0,
      saves:       p.analytics?.saves ?? 0,
    }));

  // Daily chart data for current month
  const chartMap = new Map<string, { impressions: number; reach: number; likes: number }>();
  for (const p of curPosts) {
    if (!p.publishedAt || !p.analytics) continue;
    const key = p.publishedAt.toISOString().slice(0, 10);
    const existing = chartMap.get(key) ?? { impressions: 0, reach: 0, likes: 0 };
    chartMap.set(key, {
      impressions: existing.impressions + p.analytics.impressions,
      reach:       existing.reach       + p.analytics.reach,
      likes:       existing.likes       + p.analytics.likes,
    });
  }
  const chartData = Array.from(chartMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({ date, ...vals }));

  return NextResponse.json({
    account: { pageName: account.pageName, username: account.username },
    period: { year: curYear, month: curMonth },
    prevPeriod: { year: prevYear, month: prevMonthNum },
    followers: {
      current: account.followers,
      change: followerChange,
      changePercent: oldSnapshot && oldSnapshot.followers > 0
        ? +((followerChange! / oldSnapshot.followers) * 100).toFixed(2)
        : null,
    },
    storiesCount: account.cachedStoriesCount,
    current: {
      breakdown: breakdown(curPosts),
      metrics: { ...curMetrics, engagementRate: engagementRate(curMetrics) },
    },
    previous: {
      breakdown: breakdown(prevPosts),
      metrics: { ...prevMetrics, engagementRate: engagementRate(prevMetrics) },
    },
    topPosts,
    chartData,
  });
}
