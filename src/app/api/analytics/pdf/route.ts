import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { getSpecialDaysForMonth, CATEGORY_EMOJI, CATEGORY_LABEL } from "@/lib/specialDays";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function periodRange(year: number, month: number) {
  return { start: new Date(year, month - 1, 1), end: new Date(year, month, 1) };
}

function nMonthsBack(year: number, month: number, n: number) {
  const d = new Date(year, month - 1 - n, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
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

function engRate(m: ReturnType<typeof sumMetrics>) {
  return m.reach > 0 ? +((m.likes + m.comments + m.shares + m.saves) / m.reach * 100).toFixed(2) : 0;
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

function computeConsistency(posts: Array<{ publishedAt: Date | null }>, year: number, month: number) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const now = new Date();
  const isCurrent = year === now.getFullYear() && month === now.getMonth() + 1;
  const possible = isCurrent ? now.getDate() : daysInMonth;
  const posted = new Set(posts.filter(p => p.publishedAt).map(p => p.publishedAt!.toISOString().slice(0, 10))).size;
  return { posted, possible, pct: Math.round((posted / Math.max(possible, 1)) * 100) };
}

function computeHealthScore(curEngRate: number, con: { pct: number }, cur: ReturnType<typeof sumMetrics>, prev: ReturnType<typeof sumMetrics>, types: number) {
  const engScore  = Math.min(Math.round(curEngRate / 4 * 40), 40);
  const conScore  = Math.round(con.pct / 100 * 25);
  const growth    = prev.reach > 0 ? (cur.reach - prev.reach) / prev.reach : 0;
  const reachScore = Math.min(Math.max(Math.round(10 + growth * 50), 0), 20);
  const varScore  = Math.min(types * 4 + (types >= 4 ? 3 : 0), 15);
  return Math.min(engScore + conScore + reachScore + varScore, 100);
}

function bestTypeByImpressions(posts: Array<{ mediaType: string; analytics: { impressions: number } | null }>) {
  const map: Record<string, { sum: number; count: number }> = {};
  for (const p of posts) {
    if (!p.analytics) continue;
    if (!map[p.mediaType]) map[p.mediaType] = { sum: 0, count: 0 };
    map[p.mediaType].sum += p.analytics.impressions;
    map[p.mediaType].count++;
  }
  return Object.entries(map)
    .map(([type, d]) => ({ type, avg: Math.round(d.sum / d.count), count: d.count }))
    .sort((a, b) => b.avg - a.avg);
}

function bestPostingDay(posts: Array<{ publishedAt: Date | null; analytics: { impressions: number } | null }>) {
  const map: Record<number, { sum: number; count: number }> = {};
  for (const p of posts) {
    if (!p.analytics || !p.publishedAt) continue;
    const d = new Date(p.publishedAt).getDay();
    if (!map[d]) map[d] = { sum: 0, count: 0 };
    map[d].sum += p.analytics.impressions;
    map[d].count++;
  }
  return Object.entries(map)
    .map(([d, v]) => ({ day: DAY_NAMES[parseInt(d)], avg: Math.round(v.sum / v.count) }))
    .sort((a, b) => b.avg - a.avg)[0] ?? null;
}

function healthColor(s: number) {
  if (s >= 80) return { text: "#16a34a", status: "Excellent" };
  if (s >= 60) return { text: "#2563eb", status: "Good" };
  if (s >= 40) return { text: "#d97706", status: "Fair" };
  return { text: "#dc2626", status: "Needs Attention" };
}

const TYPE_LABEL: Record<string, string> = { REEL: "Reels", IMAGE: "Static Posts", CAROUSEL: "Carousels", VIDEO: "Videos" };

async function generateAI(data: {
  pageName: string; period: string; prevPeriod: string;
  curBreakdown: { total: number; reels: number; static: number; carousel: number; video: number };
  prevBreakdown: { total: number; reels: number; static: number; carousel: number; video: number };
  curMetrics: ReturnType<typeof sumMetrics> & { engagementRate: number };
  prevMetrics: ReturnType<typeof sumMetrics> & { engagementRate: number };
  followers: number; followerChange: number | null; storiesCount: number;
  topPost: { caption: string; impressions: number; mediaType: string } | null;
  specialDays: string[]; consistency: { posted: number; possible: number; pct: number };
  healthScore: number; bestType: string | null;
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `You are a professional social media agency writing a monthly performance report for your hotel client ${data.pageName}.

IMPORTANT: Always write from the AGENCY perspective. Use "we", "our", "we delivered", "our strategy", "we achieved", "we recommend". NEVER say "your hotel", "you should", or address the client directly. Write as if presenting results of your work to the client.

DATA FOR ${data.period} vs ${data.prevPeriod}:
Health Score: ${data.healthScore}/100
Consistency: We published on ${data.consistency.posted}/${data.consistency.possible} days (${data.consistency.pct}%)
Posts: ${data.curBreakdown.total} (prev: ${data.prevBreakdown.total}) — Reels:${data.curBreakdown.reels} Static:${data.curBreakdown.static} Carousels:${data.curBreakdown.carousel}
${data.bestType ? `Best format by reach: ${data.bestType}` : ""}
Followers: ${data.followers.toLocaleString()}${data.followerChange !== null ? ` (${data.followerChange >= 0 ? "+" : ""}${data.followerChange})` : ""}
Impressions: ${data.curMetrics.impressions.toLocaleString()} (was ${data.prevMetrics.impressions.toLocaleString()})
Reach: ${data.curMetrics.reach.toLocaleString()} (was ${data.prevMetrics.reach.toLocaleString()})
Engagement Rate: ${data.curMetrics.engagementRate}% (was ${data.prevMetrics.engagementRate}%)
Likes:${data.curMetrics.likes} Comments:${data.curMetrics.comments} Shares:${data.curMetrics.shares} Saves:${data.curMetrics.saves}
${data.topPost ? `Top post: "${data.topPost.caption}" — ${data.topPost.impressions.toLocaleString()} impressions (${data.topPost.mediaType})` : ""}
Stories: ${data.storiesCount}

SPECIAL DAYS NEXT MONTH:
${data.specialDays.length > 0 ? data.specialDays.join("\n") : "None"}

Respond ONLY in JSON:
{
  "postsAnalysis": "2-3 sentences from agency about content strategy and consistency we executed",
  "followersAnalysis": "2-3 sentences from agency about audience growth we achieved",
  "engagementAnalysis": "2-3 sentences from agency about engagement results our strategy delivered",
  "contentSuggestions": ["We recommend...", "We will...", "Our strategy...", "To leverage [special day] we will...", "We plan to...", "We will continue..."],
  "overallSummary": "3-4 sentence executive summary from agency — what we delivered, key wins, priorities for next month"
}`
      }],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const m = text.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) as { postsAnalysis: string; followersAnalysis: string; engagementAnalysis: string; contentSuggestions: string[]; overallSummary: string } : null;
  } catch { return null; }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });

  const now = new Date();
  const curYear  = parseInt(searchParams.get("year")  ?? String(now.getFullYear()));
  const curMonth = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1));
  const { year: prevYear, month: prevMonthNum } = nMonthsBack(curYear, curMonth, 1);
  const { year: twoAgoYear, month: twoAgoMonth } = nMonthsBack(curYear, curMonth, 2);

  const [account, curPosts, prevPosts, twoAgoPosts] = await Promise.all([
    prisma.account.findUnique({
      where: { id: accountId },
      select: { followers: true, cachedStoriesCount: true, pageName: true, username: true },
    }),
    prisma.post.findMany({
      where: { accountId, status: "PUBLISHED", publishedAt: { gte: periodRange(curYear, curMonth).start, lt: periodRange(curYear, curMonth).end } },
      include: { analytics: true }, orderBy: { publishedAt: "asc" },
    }),
    prisma.post.findMany({
      where: { accountId, status: "PUBLISHED", publishedAt: { gte: periodRange(prevYear, prevMonthNum).start, lt: periodRange(prevYear, prevMonthNum).end } },
      include: { analytics: true },
    }),
    prisma.post.findMany({
      where: { accountId, status: "PUBLISHED", publishedAt: { gte: periodRange(twoAgoYear, twoAgoMonth).start, lt: periodRange(twoAgoYear, twoAgoMonth).end } },
      include: { analytics: true },
    }),
  ]);

  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const oldSnapshot = await prisma.followerSnapshot.findFirst({
    where: { accountId, date: { lte: thirtyDaysAgo } }, orderBy: { date: "desc" },
  });
  const followerChange = oldSnapshot ? account.followers - oldSnapshot.followers : null;

  const curMetrics    = sumMetrics(curPosts);
  const prevMetrics   = sumMetrics(prevPosts);
  const twoAgoMetrics = sumMetrics(twoAgoPosts);
  const curEngRate    = engRate(curMetrics);
  const prevEngRate   = engRate(prevMetrics);
  const twoAgoEngRate = engRate(twoAgoMetrics);

  const breakdown = (posts: typeof curPosts) => ({
    total: posts.length, reels: posts.filter(p => p.mediaType === "REEL").length,
    static: posts.filter(p => p.mediaType === "IMAGE").length,
    carousel: posts.filter(p => p.mediaType === "CAROUSEL").length,
    video: posts.filter(p => p.mediaType === "VIDEO").length,
  });

  const curBreakdown  = breakdown(curPosts);
  const prevBreakdown = breakdown(prevPosts);

  const consistency  = computeConsistency(curPosts, curYear, curMonth);
  const uniqueTypes  = new Set(curPosts.map(p => p.mediaType)).size;
  const healthScore  = computeHealthScore(curEngRate, consistency, curMetrics, prevMetrics, uniqueTypes);
  const hc           = healthColor(healthScore);
  const typePerf     = bestTypeByImpressions(curPosts);
  const bestType     = typePerf[0]?.type ?? null;
  const bestDay      = bestPostingDay(curPosts);

  const topPosts = [...curPosts]
    .filter(p => p.analytics)
    .sort((a, b) => (b.analytics?.impressions ?? 0) - (a.analytics?.impressions ?? 0))
    .slice(0, 5);

  const nextMonthDate = new Date(curYear, curMonth, 1);
  const nextYear  = nextMonthDate.getFullYear();
  const nextMonth = nextMonthDate.getMonth() + 1;
  const specialDays = getSpecialDaysForMonth(nextYear, nextMonth);

  const periodStr       = `${MONTH_NAMES[curMonth - 1]} ${curYear}`;
  const prevPeriodStr   = `${MONTH_NAMES[prevMonthNum - 1]} ${prevYear}`;
  const twoAgoPeriodStr = `${MONTH_NAMES[twoAgoMonth - 1]} ${twoAgoYear}`;

  const ai = await generateAI({
    pageName: account.pageName, period: periodStr, prevPeriod: prevPeriodStr,
    curBreakdown, prevBreakdown,
    curMetrics: { ...curMetrics, engagementRate: curEngRate },
    prevMetrics: { ...prevMetrics, engagementRate: prevEngRate },
    followers: account.followers, followerChange,
    storiesCount: account.cachedStoriesCount,
    topPost: topPosts[0] ? { caption: topPosts[0].caption.slice(0, 100), impressions: topPosts[0].analytics?.impressions ?? 0, mediaType: topPosts[0].mediaType } : null,
    specialDays: specialDays.map(d => `${d.date} — ${d.name} (${CATEGORY_LABEL[d.category]}): ${d.relevance ?? ""}`),
    consistency, healthScore, bestType,
  });

  const generated = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  const maxReach = Math.max(twoAgoMetrics.reach, prevMetrics.reach, curMetrics.reach, 1);
  const barH = (v: number) => Math.max(Math.round((v / maxReach) * 120), 4);

  const categoryBg:   Record<string, string> = { international: "#dbeafe", indian: "#fef9c3", muslim: "#f3e8ff", sikh: "#dcfce7", christian: "#fce7f3" };
  const categoryText: Record<string, string> = { international: "#1e40af", indian: "#854d0e", muslim: "#6b21a8", sikh: "#166534", christian: "#9d174d" };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${account.pageName} — Instagram Report ${periodStr}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;color:#1e293b;font-size:13px}
  .page{max-width:860px;margin:0 auto;padding:28px 20px}

  .cover{background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 45%,#6d28d9 100%);color:white;border-radius:16px;padding:36px 40px 32px;margin-bottom:18px;position:relative;overflow:hidden}
  .cover::before{content:"";position:absolute;top:-80px;right:-80px;width:280px;height:280px;background:rgba(255,255,255,0.04);border-radius:50%}
  .cover-top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}
  .cover-brand{font-size:9px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;opacity:0.5;margin-bottom:8px}
  .cover-name{font-size:26px;font-weight:800;line-height:1.15}
  .cover-sub{font-size:13px;opacity:0.65;margin-top:5px}
  .cover-handle{font-size:12px;opacity:0.4;margin-top:2px}
  .health-circle{text-align:center;flex-shrink:0}
  .health-num{font-size:52px;font-weight:900;line-height:1;color:white}
  .health-sub{font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;opacity:0.6;margin-top:2px}
  .health-status{font-size:12px;font-weight:700;margin-top:5px;padding:3px 12px;border-radius:99px;background:rgba(255,255,255,0.15);display:inline-block}
  .cover-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:rgba(255,255,255,0.08);border-radius:10px;overflow:hidden;margin-top:26px}
  .cover-kpi{background:rgba(0,0,0,0.25);padding:13px 16px}
  .cover-kpi-label{font-size:9px;opacity:0.55;font-weight:700;text-transform:uppercase;letter-spacing:0.08em}
  .cover-kpi-value{font-size:22px;font-weight:800;margin-top:3px}
  .cover-kpi-delta{font-size:11px;opacity:0.6;margin-top:2px}

  .section{background:white;border-radius:12px;padding:20px 24px;margin-bottom:14px}
  .sh{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #f1f5f9}
  .st{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#64748b}
  .sb{font-size:11px;font-weight:600;padding:2px 10px;border-radius:99px;background:#f1f5f9;color:#475569}

  .g6{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}
  .g4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  .metric{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:13px 14px}
  .ml{font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:5px}
  .mv{font-size:20px;font-weight:800;color:#0f172a}
  .mc{font-size:11px;color:#94a3b8;margin-top:4px}
  .md{font-weight:700}

  .con-row{display:flex;align-items:center;gap:12px;margin-top:14px}
  .con-bg{flex:1;background:#e2e8f0;border-radius:99px;height:9px;overflow:hidden}
  .con-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,#22c55e,#16a34a)}
  .con-pct{font-size:12px;font-weight:700;color:#16a34a;min-width:36px;text-align:right}

  .callout{display:inline-flex;align-items:center;gap:7px;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:7px;padding:7px 13px;font-size:12px;color:#5b21b6;font-weight:600;margin-top:10px;margin-right:8px}

  .ai-box{background:#f0f9ff;border-left:3px solid #0ea5e9;border-radius:0 8px 8px 0;padding:11px 15px;margin-top:14px}
  .ai-lbl{font-size:9px;font-weight:800;color:#0284c7;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:5px}
  .ai-box p{font-size:12.5px;color:#0c4a6e;line-height:1.7}
  .no-ai{background:#fffbeb;border:1px solid #fde68a;border-radius:7px;padding:9px 13px;margin-top:12px;font-size:11.5px;color:#92400e}

  .potm{background:linear-gradient(135deg,#fef9c3,#fef3c7);border:2px solid #fbbf24;border-radius:12px;padding:16px 18px;display:flex;gap:15px;align-items:flex-start}
  .potm-img{width:76px;height:76px;object-fit:cover;border-radius:9px;flex-shrink:0}
  .potm-ph{width:76px;height:76px;border-radius:9px;flex-shrink:0;background:#fde68a;display:flex;align-items:center;justify-content:center;font-size:26px}
  .potm-lbl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#92400e;margin-bottom:4px}
  .potm-cap{font-size:13px;font-weight:600;color:#78350f;line-height:1.5}
  .potm-stats{display:flex;gap:14px;margin-top:8px;flex-wrap:wrap}
  .ps-l{font-size:10px;color:#a16207}
  .ps-v{font-size:15px;font-weight:800;color:#78350f}

  .post-row{display:flex;align-items:flex-start;gap:11px;padding:10px 0;border-bottom:1px solid #f8fafc}
  .post-row:last-child{border-bottom:none}
  .rank{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex-shrink:0}
  .pt{width:44px;height:44px;object-fit:cover;border-radius:7px;flex-shrink:0}
  .pt-ph{width:44px;height:44px;border-radius:7px;flex-shrink:0;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-size:16px}
  .pi{flex:1;min-width:0}
  .pi-type{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#7c3aed}
  .pi-cap{font-size:12px;color:#374151;margin-top:2px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  .pst{display:flex;gap:10px;flex-shrink:0}
  .psl{font-size:9px;color:#9ca3af}
  .psv{font-size:12px;font-weight:700;color:#0f172a}

  .trend-wrap{display:flex;align-items:flex-end;gap:16px;height:130px;padding:0 10px;margin-bottom:6px}
  .trend-col{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end}
  .trend-val{font-size:10px;color:#64748b;margin-bottom:3px;text-align:center}
  .trend-bar{width:100%;border-radius:4px 4px 0 0}
  .trend-lbl{font-size:11px;font-weight:600;color:#475569;margin-top:5px;text-align:center}
  .trend-eng{font-size:10px;color:#94a3b8;margin-top:1px;text-align:center}

  .sug{display:flex;gap:10px;padding:9px 0;border-bottom:1px solid #f8fafc;align-items:flex-start}
  .sug:last-child{border-bottom:none}
  .sug-n{width:21px;height:21px;background:#4f46e5;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-top:1px}
  .sug-t{font-size:12.5px;color:#374151;line-height:1.6}

  .day-row{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid #f8fafc;align-items:flex-start}
  .day-row:last-child{border-bottom:none}
  .day-badge{font-size:10px;font-weight:600;padding:2px 8px;border-radius:99px;white-space:nowrap;flex-shrink:0}
  .day-name{font-size:13px;font-weight:600}
  .day-date{font-size:11px;color:#94a3b8;margin-top:1px}
  .day-rel{font-size:11px;color:#64748b;margin-top:2px;font-style:italic}

  .summary{background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #86efac;border-radius:12px;padding:18px 22px}
  .sum-lbl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#15803d;margin-bottom:8px}
  .summary p{font-size:13px;color:#166534;line-height:1.8}

  .footer{text-align:center;font-size:11px;color:#94a3b8;margin-top:22px;padding-top:14px;border-top:1px solid #e2e8f0}

  @media print{
    body{background:white}
    .page{padding:10px}
    .section{break-inside:avoid}
    .cover,.ai-box,.summary,.potm,.con-fill,.sug-n,.rank,.trend-bar,.day-badge{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  }
  @page{margin:12mm}
</style>
</head>
<body>
<div class="page">

<!-- COVER -->
<div class="cover">
  <div class="cover-top">
    <div>
      <div class="cover-brand">Monthly Performance Report · Softmarche</div>
      <div class="cover-name">${account.pageName}</div>
      <div class="cover-sub">${periodStr} &nbsp;·&nbsp; Compared to ${prevPeriodStr}</div>
      ${account.username ? `<div class="cover-handle">@${account.username}</div>` : ""}
    </div>
    <div class="health-circle">
      <div class="health-num">${healthScore}</div>
      <div class="health-sub">Health Score</div>
      <div class="health-status" style="color:${hc.text}">${hc.status}</div>
    </div>
  </div>
  <div class="cover-kpis">
    ${[
      { label: "Reach", value: curMetrics.reach.toLocaleString(), d: delta(curMetrics.reach, prevMetrics.reach) },
      { label: "Impressions", value: curMetrics.impressions.toLocaleString(), d: delta(curMetrics.impressions, prevMetrics.impressions) },
      { label: "Engagement", value: curEngRate + "%", d: delta(curEngRate, prevEngRate) },
      { label: "Followers", value: account.followers.toLocaleString(), extra: followerChange !== null ? (followerChange >= 0 ? `+${followerChange} this month` : `${followerChange} this month`) : "tracking" },
    ].map(k => `<div class="cover-kpi">
      <div class="cover-kpi-label">${k.label}</div>
      <div class="cover-kpi-value">${k.value}</div>
      <div class="cover-kpi-delta">${"extra" in k ? k.extra : fmtDelta(k.d ?? null) + " vs last month"}</div>
    </div>`).join("")}
  </div>
</div>

<!-- CONTENT PUBLISHED -->
<div class="section">
  <div class="sh"><div class="st">Content We Published</div><div class="sb">${periodStr}</div></div>
  <div class="g6">
    ${[
      { label: "Total", cur: curBreakdown.total, prev: prevBreakdown.total },
      { label: "Reels", cur: curBreakdown.reels, prev: prevBreakdown.reels },
      { label: "Static", cur: curBreakdown.static, prev: prevBreakdown.static },
      { label: "Carousels", cur: curBreakdown.carousel, prev: prevBreakdown.carousel },
      { label: "Videos", cur: curBreakdown.video, prev: prevBreakdown.video },
      { label: "Stories", cur: account.cachedStoriesCount, prev: 0, nc: true },
    ].map(m => {
      const d = !("nc" in m) ? delta(m.cur, m.prev) : null;
      return `<div class="metric">
        <div class="ml">${m.label}</div>
        <div class="mv">${m.cur}</div>
        ${"nc" in m ? `<div class="mc">live now</div>` : `<div class="mc">was ${m.prev} <span class="md" style="color:${deltaColor(d)}">${fmtDelta(d)}</span></div>`}
      </div>`;
    }).join("")}
  </div>
  <div class="con-row">
    <span style="font-size:12px;color:#64748b;font-weight:600;white-space:nowrap">Posting Consistency</span>
    <div class="con-bg"><div class="con-fill" style="width:${consistency.pct}%"></div></div>
    <span class="con-pct">${consistency.pct}%</span>
    <span style="font-size:11px;color:#94a3b8">${consistency.posted}/${consistency.possible} days</span>
  </div>
  <div style="margin-top:10px">
    ${bestType ? `<span class="callout">⭐ Best format: <strong>${TYPE_LABEL[bestType] ?? bestType}</strong>${typePerf[0] ? ` — avg ${typePerf[0].avg.toLocaleString()} impressions/post` : ""}</span>` : ""}
    ${bestDay ? `<span class="callout">📅 Best day: <strong>${bestDay.day}</strong> — avg ${bestDay.avg.toLocaleString()} impressions</span>` : ""}
  </div>
  ${ai ? `<div class="ai-box"><div class="ai-lbl">Agency Insight</div><p>${ai.postsAnalysis}</p></div>` : `<div class="no-ai">Add ANTHROPIC_API_KEY to enable AI insights.</div>`}
</div>

<!-- PERFORMANCE -->
<div class="section">
  <div class="sh"><div class="st">Performance Results</div><div class="sb">vs ${prevPeriodStr}</div></div>
  <div class="g4">
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
        <div class="ml">${m.label}</div>
        <div class="mv">${m.cur.toLocaleString()}${"pct" in m ? "%" : ""}</div>
        <div class="mc">was ${m.prev.toLocaleString()}${"pct" in m ? "%" : ""} <span class="md" style="color:${deltaColor(d)}">${fmtDelta(d)}</span></div>
      </div>`;
    }).join("")}
  </div>
  ${ai ? `<div class="ai-box"><div class="ai-lbl">Agency Insight</div><p>${ai.engagementAnalysis}</p></div>` : ""}
</div>

<!-- FOLLOWERS -->
<div class="section">
  <div class="sh"><div class="st">Audience Growth</div></div>
  <div style="display:flex;align-items:center;gap:28px;flex-wrap:wrap">
    <div>
      <div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:5px">Total Followers</div>
      <div style="font-size:38px;font-weight:800;color:#0f172a">${account.followers.toLocaleString()}</div>
    </div>
    <div style="width:1px;height:48px;background:#e2e8f0"></div>
    <div>
      <div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:5px">Change vs 30 Days Ago</div>
      ${followerChange !== null
        ? `<div style="font-size:22px;font-weight:800;color:${followerChange >= 0 ? "#16a34a" : "#dc2626"}">${followerChange >= 0 ? "+" : ""}${followerChange.toLocaleString()} followers</div>`
        : `<div style="color:#9ca3af;font-size:13px">Tracking — shows after 30 days</div>`}
    </div>
  </div>
  ${ai ? `<div class="ai-box"><div class="ai-lbl">Agency Insight</div><p>${ai.followersAnalysis}</p></div>` : ""}
</div>

<!-- POST OF THE MONTH -->
${topPosts[0] ? `
<div class="section">
  <div class="sh"><div class="st">Post of the Month</div><div class="sb">🏆 Best performer</div></div>
  <div class="potm">
    ${topPosts[0].thumbnailUrl
      ? `<img class="potm-img" src="${topPosts[0].thumbnailUrl}" alt="" />`
      : `<div class="potm-ph">${topPosts[0].mediaType === "REEL" ? "🎬" : topPosts[0].mediaType === "VIDEO" ? "📹" : topPosts[0].mediaType === "CAROUSEL" ? "🖼" : "📷"}</div>`}
    <div style="flex:1">
      <div class="potm-lbl">${topPosts[0].mediaType} · ${topPosts[0].publishedAt ? new Date(topPosts[0].publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long" }) : ""}</div>
      <div class="potm-cap">${topPosts[0].caption.slice(0, 160)}</div>
      <div class="potm-stats">
        ${[
          { l: "Impressions", v: topPosts[0].analytics?.impressions ?? 0 },
          { l: "Reach", v: topPosts[0].analytics?.reach ?? 0 },
          { l: "Likes", v: topPosts[0].analytics?.likes ?? 0 },
          { l: "Saves", v: topPosts[0].analytics?.saves ?? 0 },
          { l: "Comments", v: topPosts[0].analytics?.comments ?? 0 },
          { l: "Shares", v: topPosts[0].analytics?.shares ?? 0 },
        ].map(s => `<div><div class="ps-l">${s.l}</div><div class="ps-v">${s.v.toLocaleString()}</div></div>`).join("")}
      </div>
    </div>
  </div>
</div>
` : ""}

<!-- TOP POSTS 2-5 -->
${topPosts.length > 1 ? `
<div class="section">
  <div class="sh"><div class="st">Other Top Posts</div><div class="sb">${periodStr}</div></div>
  ${topPosts.slice(1).map((p, idx) => {
    const rank = idx + 2;
    const rankBg = rank === 2 ? "#f1f5f9" : rank === 3 ? "#ffedd5" : "#f8fafc";
    const rankColor = rank === 2 ? "#374151" : rank === 3 ? "#9a3412" : "#9ca3af";
    return `<div class="post-row">
      <div class="rank" style="background:${rankBg};color:${rankColor}">${rank}</div>
      ${p.thumbnailUrl
        ? `<img class="pt" src="${p.thumbnailUrl}" alt="" />`
        : `<div class="pt-ph">${p.mediaType === "REEL" ? "🎬" : p.mediaType === "VIDEO" ? "📹" : p.mediaType === "CAROUSEL" ? "🖼" : "📷"}</div>`}
      <div class="pi">
        <div class="pi-type">${p.mediaType} · ${p.publishedAt ? new Date(p.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}</div>
        <div class="pi-cap">${p.caption.slice(0, 120)}</div>
      </div>
      <div class="pst">
        <div><div class="psl">Impressions</div><div class="psv">${(p.analytics?.impressions ?? 0).toLocaleString()}</div></div>
        <div><div class="psl">Reach</div><div class="psv">${(p.analytics?.reach ?? 0).toLocaleString()}</div></div>
        <div><div class="psl">Likes</div><div class="psv">${(p.analytics?.likes ?? 0).toLocaleString()}</div></div>
        <div><div class="psl">Saves</div><div class="psv">${(p.analytics?.saves ?? 0).toLocaleString()}</div></div>
      </div>
    </div>`;
  }).join("")}
</div>
` : ""}

<!-- 3-MONTH REACH TREND -->
<div class="section">
  <div class="sh"><div class="st">3-Month Reach Trend</div></div>
  <div class="trend-wrap">
    ${[
      { label: twoAgoPeriodStr.split(" ")[0], reach: twoAgoMetrics.reach, eng: twoAgoEngRate, color: "#c7d2fe" },
      { label: prevPeriodStr.split(" ")[0],   reach: prevMetrics.reach,   eng: prevEngRate,   color: "#818cf8" },
      { label: periodStr.split(" ")[0],       reach: curMetrics.reach,    eng: curEngRate,    color: "#4f46e5" },
    ].map(m => `
      <div class="trend-col">
        <div class="trend-val">${m.reach.toLocaleString()}</div>
        <div class="trend-bar" style="background:${m.color};height:${barH(m.reach)}px"></div>
        <div class="trend-lbl">${m.label}</div>
        <div class="trend-eng">${m.eng}% eng</div>
      </div>
    `).join("")}
  </div>
  <div style="display:flex;justify-content:center;gap:20px;margin-top:4px">
    ${[
      { label: twoAgoPeriodStr.split(" ")[0], color: "#c7d2fe" },
      { label: prevPeriodStr.split(" ")[0],   color: "#818cf8" },
      { label: periodStr.split(" ")[0],       color: "#4f46e5" },
    ].map(m => `<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#64748b"><div style="width:11px;height:11px;border-radius:3px;background:${m.color}"></div>${m.label}</div>`).join("")}
  </div>
</div>

<!-- NEXT MONTH PLAN -->
<div class="section">
  <div class="sh"><div class="st">Our Plan for ${MONTH_NAMES[nextMonth - 1]} ${nextYear}</div></div>
  ${ai && ai.contentSuggestions.length > 0
    ? ai.contentSuggestions.map((s, i) => `<div class="sug"><div class="sug-n">${i + 1}</div><div class="sug-t">${s}</div></div>`).join("")
    : `<p style="color:#64748b;font-size:13px">Add ANTHROPIC_API_KEY to enable AI-powered planning.</p>`}
</div>

<!-- SPECIAL DAYS -->
${specialDays.length > 0 ? `
<div class="section">
  <div class="sh"><div class="st">Key Dates — ${MONTH_NAMES[nextMonth - 1]} ${nextYear}</div><div class="sb">Content opportunities</div></div>
  ${specialDays.map(day => `
    <div class="day-row">
      <span class="day-badge" style="background:${categoryBg[day.category]};color:${categoryText[day.category]}">${CATEGORY_EMOJI[day.category]} ${CATEGORY_LABEL[day.category]}</span>
      <div>
        <div class="day-name">${day.name}</div>
        <div class="day-date">${new Date(day.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</div>
        ${day.relevance ? `<div class="day-rel">💡 ${day.relevance}</div>` : ""}
      </div>
    </div>
  `).join("")}
</div>
` : ""}

<!-- EXECUTIVE SUMMARY -->
${ai ? `
<div class="summary">
  <div class="sum-lbl">📋 Executive Summary</div>
  <p>${ai.overallSummary}</p>
</div>
` : ""}

<div class="footer">
  Prepared by <strong>Softmarche</strong> for ${account.pageName} &nbsp;·&nbsp; ${generated}<br>
  Data sourced from Instagram Graph API &nbsp;·&nbsp; File → Print → Save as PDF to export
</div>

</div>
</body>
</html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
