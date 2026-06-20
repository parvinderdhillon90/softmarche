import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { getSpecialDaysForMonth, CATEGORY_EMOJI, CATEGORY_LABEL } from "@/lib/specialDays";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function periodRange(year: number, month: number) {
  return { start: new Date(year, month - 1, 1), end: new Date(year, month, 1) };
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

function engagementRate(m: ReturnType<typeof sumMetrics>) {
  return m.reach > 0 ? +((( m.likes + m.comments + m.shares + m.saves) / m.reach) * 100).toFixed(2) : 0;
}

function delta(cur: number, prev: number) {
  if (prev === 0) return null;
  return +(((cur - prev) / prev) * 100).toFixed(1);
}

function fmtDelta(d: number | null) {
  if (d === null) return "—";
  return (d >= 0 ? "▲ +" : "▼ ") + Math.abs(d) + "%";
}

function deltaColor(d: number | null) {
  if (d === null) return "#9ca3af";
  return d >= 0 ? "#16a34a" : "#dc2626";
}

async function generateAIAnalysis(data: {
  pageName: string;
  period: string;
  prevPeriod: string;
  curBreakdown: { total: number; reels: number; static: number; carousel: number; video: number };
  prevBreakdown: { total: number; reels: number; static: number; carousel: number; video: number };
  curMetrics: ReturnType<typeof sumMetrics> & { engagementRate: number };
  prevMetrics: ReturnType<typeof sumMetrics> & { engagementRate: number };
  followers: number;
  followerChange: number | null;
  storiesCount: number;
  topPost: { caption: string; impressions: number; mediaType: string } | null;
  specialDays: string[];
}): Promise<{
  postsAnalysis: string;
  followersAnalysis: string;
  engagementAnalysis: string;
  contentSuggestions: string[];
  overallSummary: string;
} | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new Anthropic({ apiKey });

    const prompt = `You are a social media analytics expert specializing in hotel and hospitality marketing. Analyze the following Instagram data for ${data.pageName} for ${data.period} (compared to ${data.prevPeriod}) and provide concise, actionable insights.

ANALYTICS DATA:
Posts: ${data.curBreakdown.total} this month (${data.prevBreakdown.total} last month)
- Reels: ${data.curBreakdown.reels}, Static: ${data.curBreakdown.static}, Carousels: ${data.curBreakdown.carousel}, Videos: ${data.curBreakdown.video}
Followers: ${data.followers.toLocaleString()}${data.followerChange !== null ? ` (${data.followerChange >= 0 ? "+" : ""}${data.followerChange} vs last month)` : ""}
Impressions: ${data.curMetrics.impressions.toLocaleString()} (was ${data.prevMetrics.impressions.toLocaleString()})
Reach: ${data.curMetrics.reach.toLocaleString()} (was ${data.prevMetrics.reach.toLocaleString()})
Engagement Rate: ${data.curMetrics.engagementRate}% (was ${data.prevMetrics.engagementRate}%)
Likes: ${data.curMetrics.likes}, Comments: ${data.curMetrics.comments}, Shares: ${data.curMetrics.shares}, Saves: ${data.curMetrics.saves}
Stories count: ${data.storiesCount}
${data.topPost ? `Top post: "${data.topPost.caption}" — ${data.topPost.impressions.toLocaleString()} impressions (${data.topPost.mediaType})` : ""}

SPECIAL DAYS NEXT MONTH:
${data.specialDays.length > 0 ? data.specialDays.join("\n") : "No major special days"}

Respond in JSON with exactly these keys:
{
  "postsAnalysis": "2-3 sentence analysis of posting frequency and content mix",
  "followersAnalysis": "2-3 sentence analysis of follower growth and audience",
  "engagementAnalysis": "2-3 sentence analysis of engagement metrics and what's driving results",
  "contentSuggestions": ["suggestion 1", "suggestion 2", "suggestion 3", "suggestion 4", "suggestion 5", "suggestion 6"],
  "overallSummary": "3-4 sentence overall performance summary with key takeaways and priorities for next month"
}

Keep suggestions specific, actionable, and relevant to hotel/hospitality. Reference special days where appropriate.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

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

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const oldSnapshot = await prisma.followerSnapshot.findFirst({
    where: { accountId, date: { lte: thirtyDaysAgo } },
    orderBy: { date: "desc" },
  });

  const followerChange = oldSnapshot ? account.followers - oldSnapshot.followers : null;

  const curMetrics  = sumMetrics(curPosts);
  const prevMetrics = sumMetrics(prevPosts);
  const curEngRate  = engagementRate(curMetrics);
  const prevEngRate = engagementRate(prevMetrics);

  const breakdown = (posts: typeof curPosts) => ({
    total: posts.length,
    reels: posts.filter(p => p.mediaType === "REEL").length,
    static: posts.filter(p => p.mediaType === "IMAGE").length,
    carousel: posts.filter(p => p.mediaType === "CAROUSEL").length,
    video: posts.filter(p => p.mediaType === "VIDEO").length,
  });

  const curBreakdown  = breakdown(curPosts);
  const prevBreakdown = breakdown(prevPosts);

  const topPosts = [...curPosts]
    .filter(p => p.analytics)
    .sort((a, b) => (b.analytics?.impressions ?? 0) - (a.analytics?.impressions ?? 0))
    .slice(0, 5);

  // Next month for special days
  const nextMonthDate = new Date(curYear, curMonth, 1);
  const nextYear = nextMonthDate.getFullYear();
  const nextMonth = nextMonthDate.getMonth() + 1;
  const specialDays = getSpecialDaysForMonth(nextYear, nextMonth);

  const periodStr = `${MONTH_NAMES[curMonth - 1]} ${curYear}`;
  const prevPeriodStr = `${MONTH_NAMES[prevMonthNum - 1]} ${prevYear}`;

  const ai = await generateAIAnalysis({
    pageName: account.pageName,
    period: periodStr,
    prevPeriod: prevPeriodStr,
    curBreakdown,
    prevBreakdown,
    curMetrics: { ...curMetrics, engagementRate: curEngRate },
    prevMetrics: { ...prevMetrics, engagementRate: prevEngRate },
    followers: account.followers,
    followerChange,
    storiesCount: account.cachedStoriesCount,
    topPost: topPosts[0] ? {
      caption: topPosts[0].caption.slice(0, 100),
      impressions: topPosts[0].analytics?.impressions ?? 0,
      mediaType: topPosts[0].mediaType,
    } : null,
    specialDays: specialDays.map(d => `${d.date} — ${d.name} (${CATEGORY_LABEL[d.category]}): ${d.relevance ?? ""}`),
  });

  const generated = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  const categoryBg: Record<string, string> = {
    international: "#dbeafe",
    indian: "#fef9c3",
    muslim: "#f3e8ff",
    sikh: "#dcfce7",
    christian: "#fce7f3",
  };
  const categoryText: Record<string, string> = {
    international: "#1e40af",
    indian: "#854d0e",
    muslim: "#6b21a8",
    sikh: "#166534",
    christian: "#9d174d",
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${account.pageName} — Instagram Report ${periodStr}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; font-size: 13px; }
  .page { max-width: 900px; margin: 0 auto; padding: 32px 24px; }
  .header { background: linear-gradient(135deg, #1e40af 0%, #7c3aed 100%); color: white; border-radius: 16px; padding: 28px 32px; margin-bottom: 28px; }
  .header h1 { font-size: 22px; font-weight: 700; }
  .header p { font-size: 13px; margin-top: 4px; opacity: 0.85; }
  .header .meta { display: flex; gap: 20px; margin-top: 16px; }
  .header .meta-item { font-size: 12px; opacity: 0.8; }
  .header .meta-item strong { display: block; font-size: 18px; font-weight: 700; opacity: 1; }
  .section { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 24px; margin-bottom: 20px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .metric { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; }
  .metric-label { font-size: 11px; color: #64748b; font-weight: 500; margin-bottom: 4px; }
  .metric-value { font-size: 22px; font-weight: 700; color: #1e293b; }
  .metric-compare { font-size: 11px; color: #94a3b8; margin-top: 4px; }
  .metric-delta { font-weight: 600; }
  .ai-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 12px 16px; margin-top: 14px; }
  .ai-box-label { font-size: 10px; font-weight: 700; color: #0284c7; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
  .ai-box p { font-size: 12.5px; color: #0c4a6e; line-height: 1.6; }
  .follower-big { font-size: 40px; font-weight: 700; color: #1e293b; }
  .follower-change { font-size: 18px; font-weight: 600; }
  .post-row { display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
  .post-row:last-child { border-bottom: none; }
  .rank { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
  .post-thumb { width: 52px; height: 52px; object-fit: cover; border-radius: 8px; flex-shrink: 0; background: #e2e8f0; }
  .post-thumb-placeholder { width: 52px; height: 52px; border-radius: 8px; flex-shrink: 0; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 18px; }
  .post-info { flex: 1; min-width: 0; }
  .post-type { font-size: 10px; font-weight: 700; color: #7c3aed; text-transform: uppercase; letter-spacing: 0.06em; }
  .post-caption { font-size: 12px; color: #374151; margin-top: 2px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .post-stats { display: flex; gap: 12px; margin-left: auto; flex-shrink: 0; text-align: right; }
  .post-stat { }
  .post-stat-label { font-size: 10px; color: #9ca3af; }
  .post-stat-value { font-size: 13px; font-weight: 600; color: #1e293b; }
  .suggestion { display: flex; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f1f5f9; align-items: flex-start; }
  .suggestion:last-child { border-bottom: none; }
  .suggestion-num { width: 22px; height: 22px; background: #4f46e5; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
  .suggestion-text { font-size: 12.5px; color: #374151; line-height: 1.5; }
  .special-day { display: flex; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f1f5f9; align-items: flex-start; }
  .special-day:last-child { border-bottom: none; }
  .day-badge { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 99px; white-space: nowrap; flex-shrink: 0; }
  .day-info { }
  .day-name { font-size: 13px; font-weight: 600; color: #1e293b; }
  .day-date { font-size: 11px; color: #94a3b8; margin-top: 1px; }
  .day-relevance { font-size: 11.5px; color: #64748b; margin-top: 3px; font-style: italic; }
  .summary-box { background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 1px solid #86efac; border-radius: 10px; padding: 16px 20px; }
  .summary-box p { font-size: 13px; color: #166534; line-height: 1.7; }
  .footer { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
  .no-ai { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 14px; margin-top: 14px; font-size: 11.5px; color: #92400e; }
  @media print {
    body { background: white; font-size: 12px; }
    .page { padding: 20px; }
    .section { break-inside: avoid; }
    .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .ai-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .summary-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .day-badge { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .suggestion-num { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .rank { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  @page { margin: 16mm; }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <h1>${account.pageName}</h1>
    <p>Instagram Performance Report · ${periodStr} vs ${prevPeriodStr}</p>
    ${account.username ? `<p style="margin-top:2px;opacity:0.7">@${account.username}</p>` : ""}
    <div class="meta">
      <div class="meta-item"><strong>${account.followers.toLocaleString()}</strong> Followers</div>
      <div class="meta-item"><strong>${curBreakdown.total}</strong> Posts this month</div>
      <div class="meta-item"><strong>${curMetrics.impressions.toLocaleString()}</strong> Impressions</div>
      <div class="meta-item"><strong>${curEngRate}%</strong> Engagement rate</div>
    </div>
  </div>

  <!-- Posts Section -->
  <div class="section">
    <div class="section-title">Posts This Month</div>
    <div class="grid-4" style="grid-template-columns: repeat(6,1fr)">
      ${[
        { label: "Total Posts", cur: curBreakdown.total, prev: prevBreakdown.total },
        { label: "Reels", cur: curBreakdown.reels, prev: prevBreakdown.reels },
        { label: "Static", cur: curBreakdown.static, prev: prevBreakdown.static },
        { label: "Carousels", cur: curBreakdown.carousel, prev: prevBreakdown.carousel },
        { label: "Videos", cur: curBreakdown.video, prev: prevBreakdown.video },
        { label: "Live Stories", cur: account.cachedStoriesCount, prev: 0, noCompare: true },
      ].map(m => {
        const d = !('noCompare' in m && m.noCompare) ? delta(m.cur, m.prev) : null;
        return `<div class="metric">
          <div class="metric-label">${m.label}</div>
          <div class="metric-value">${m.cur}</div>
          ${'noCompare' in m && m.noCompare
            ? `<div class="metric-compare">right now</div>`
            : `<div class="metric-compare">was ${m.prev} &nbsp;<span class="metric-delta" style="color:${deltaColor(d)}">${fmtDelta(d)}</span></div>`}
        </div>`;
      }).join("")}
    </div>
    ${ai ? `<div class="ai-box"><div class="ai-box-label">🤖 AI Analysis</div><p>${ai.postsAnalysis}</p></div>` : `<div class="no-ai">Add ANTHROPIC_API_KEY to Vercel environment variables to enable AI analysis.</div>`}
  </div>

  <!-- Followers Section -->
  <div class="section">
    <div class="section-title">Followers</div>
    <div style="display:flex;align-items:center;gap:32px;flex-wrap:wrap">
      <div>
        <div style="font-size:11px;color:#64748b;font-weight:500;margin-bottom:4px">Total Followers</div>
        <div class="follower-big">${account.followers.toLocaleString()}</div>
      </div>
      <div style="width:1px;height:48px;background:#e2e8f0"></div>
      <div>
        <div style="font-size:11px;color:#64748b;font-weight:500;margin-bottom:4px">Change vs 30 days ago</div>
        ${followerChange !== null
          ? `<div class="follower-change" style="color:${followerChange >= 0 ? "#16a34a" : "#dc2626"}">${followerChange >= 0 ? "+" : ""}${followerChange.toLocaleString()} followers</div>`
          : `<div style="color:#9ca3af;font-size:13px">Not enough history yet — will show after 30 days of tracking</div>`
        }
      </div>
    </div>
    ${ai ? `<div class="ai-box"><div class="ai-box-label">🤖 AI Analysis</div><p>${ai.followersAnalysis}</p></div>` : ""}
  </div>

  <!-- Performance Metrics -->
  <div class="section">
    <div class="section-title">Performance vs ${prevPeriodStr}</div>
    <div class="grid-4">
      ${[
        { label: "Impressions", cur: curMetrics.impressions, prev: prevMetrics.impressions },
        { label: "Reach", cur: curMetrics.reach, prev: prevMetrics.reach },
        { label: "Engagement Rate", cur: curEngRate, prev: prevEngRate, pct: true },
        { label: "Likes", cur: curMetrics.likes, prev: prevMetrics.likes },
        { label: "Comments", cur: curMetrics.comments, prev: prevMetrics.comments },
        { label: "Shares", cur: curMetrics.shares, prev: prevMetrics.shares },
        { label: "Saves", cur: curMetrics.saves, prev: prevMetrics.saves },
        { label: "Clicks", cur: curMetrics.clicks, prev: prevMetrics.clicks },
      ].map(m => {
        const d = delta(m.cur, m.prev);
        return `<div class="metric">
          <div class="metric-label">${m.label}</div>
          <div class="metric-value">${m.cur.toLocaleString()}${m.pct ? "%" : ""}</div>
          <div class="metric-compare">was ${m.prev.toLocaleString()}${m.pct ? "%" : ""} &nbsp;<span class="metric-delta" style="color:${deltaColor(d)}">${fmtDelta(d)}</span></div>
        </div>`;
      }).join("")}
    </div>
    ${ai ? `<div class="ai-box"><div class="ai-box-label">🤖 AI Analysis</div><p>${ai.engagementAnalysis}</p></div>` : ""}
  </div>

  <!-- Top 5 Posts -->
  ${topPosts.length > 0 ? `
  <div class="section">
    <div class="section-title">Top 5 Best Performing Posts</div>
    ${topPosts.map((p, i) => `
      <div class="post-row">
        <div class="rank" style="background:${i === 0 ? "#fef9c3" : i === 1 ? "#f1f5f9" : i === 2 ? "#ffedd5" : "#f8fafc"};color:${i === 0 ? "#854d0e" : i === 1 ? "#374151" : i === 2 ? "#9a3412" : "#9ca3af"}">${i + 1}</div>
        ${p.thumbnailUrl
          ? `<img class="post-thumb" src="${p.thumbnailUrl}" alt="" />`
          : `<div class="post-thumb-placeholder">${p.mediaType === "REEL" ? "🎬" : p.mediaType === "VIDEO" ? "📹" : p.mediaType === "CAROUSEL" ? "🖼" : "📷"}</div>`
        }
        <div class="post-info">
          <div class="post-type">${p.mediaType} · ${p.publishedAt ? new Date(p.publishedAt).toLocaleDateString("en-IN", { weekday: undefined, day: "numeric", month: "short" }) : ""}</div>
          <div class="post-caption">${p.caption.slice(0, 120)}</div>
        </div>
        <div class="post-stats">
          <div class="post-stat"><div class="post-stat-label">Impressions</div><div class="post-stat-value">${(p.analytics?.impressions ?? 0).toLocaleString()}</div></div>
          <div class="post-stat"><div class="post-stat-label">Reach</div><div class="post-stat-value">${(p.analytics?.reach ?? 0).toLocaleString()}</div></div>
          <div class="post-stat"><div class="post-stat-label">Likes</div><div class="post-stat-value">${(p.analytics?.likes ?? 0).toLocaleString()}</div></div>
          <div class="post-stat"><div class="post-stat-label">Saves</div><div class="post-stat-value">${(p.analytics?.saves ?? 0).toLocaleString()}</div></div>
        </div>
      </div>
    `).join("")}
  </div>
  ` : ""}

  <!-- Content Suggestions for Next Month -->
  <div class="section">
    <div class="section-title">Content Suggestions for ${MONTH_NAMES[nextMonth - 1]} ${nextYear}</div>
    ${ai && ai.contentSuggestions.length > 0
      ? ai.contentSuggestions.map((s, i) => `
        <div class="suggestion">
          <div class="suggestion-num">${i + 1}</div>
          <div class="suggestion-text">${s}</div>
        </div>
      `).join("")
      : `<p style="color:#64748b;font-size:13px">Add ANTHROPIC_API_KEY to enable AI-powered content suggestions.</p>`
    }
  </div>

  <!-- Special Days Next Month -->
  <div class="section">
    <div class="section-title">Special Days in ${MONTH_NAMES[nextMonth - 1]} ${nextYear}</div>
    ${specialDays.length > 0
      ? specialDays.map(day => `
        <div class="special-day">
          <span class="day-badge" style="background:${categoryBg[day.category]};color:${categoryText[day.category]}">${CATEGORY_EMOJI[day.category]} ${CATEGORY_LABEL[day.category]}</span>
          <div class="day-info">
            <div class="day-name">${day.name}</div>
            <div class="day-date">${new Date(day.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</div>
            ${day.relevance ? `<div class="day-relevance">💡 ${day.relevance}</div>` : ""}
          </div>
        </div>
      `).join("")
      : `<p style="color:#64748b;font-size:13px">No major special days in ${MONTH_NAMES[nextMonth - 1]} ${nextYear}.</p>`
    }
  </div>

  <!-- Overall Summary -->
  ${ai ? `
  <div class="section">
    <div class="section-title">Overall Summary &amp; Key Takeaways</div>
    <div class="summary-box">
      <p>${ai.overallSummary}</p>
    </div>
  </div>
  ` : ""}

  <div class="footer">
    Report generated by <strong>Softmarche</strong> · ${generated} · Data sourced from Instagram Graph API
    <br>To save as PDF: File → Print → Save as PDF (or Ctrl+P)
  </div>

</div>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
