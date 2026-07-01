"use client";

import { useState, useEffect } from "react";
import { RefreshCw, TrendingUp, TrendingDown, Minus, Users, Image, Film, LayoutGrid, Video, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Account } from "@/types";
import { format } from "date-fns";

interface MetricSet {
  impressions: number; reach: number; likes: number; comments: number;
  shares: number; saves: number; clicks: number; engagementRate: number;
}
interface Breakdown { total: number; reels: number; static: number; carousel: number; video: number; }
interface TopPost {
  id: string; caption: string; mediaType: string; publishedAt: string | null;
  mediaUrl: string | null; thumbnailUrl: string | null; impressions: number; reach: number; likes: number;
  comments: number; shares: number; saves: number;
}
interface Report {
  account: { pageName: string; username: string | null };
  period: { year: number; month: number };
  prevPeriod: { year: number; month: number };
  followers: { current: number; change: number | null; changePercent: number | null };
  storiesCount: number;
  current: { breakdown: Breakdown; metrics: MetricSet };
  previous: { breakdown: Breakdown; metrics: MetricSet };
  topPosts: TopPost[];
  chartData: { date: string; impressions: number; reach: number; likes: number }[];
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function Delta({ current, previous, suffix = "" }: { current: number; previous: number; suffix?: string }) {
  if (previous === 0) return <span className="text-xs text-gray-400">—</span>;
  const pct = (((current - previous) / previous) * 100).toFixed(1);
  const up = current >= previous;
  return (
    <span className={`text-xs font-semibold flex items-center gap-0.5 ${up ? "text-green-600" : "text-red-500"}`}>
      {up ? <TrendingUp size={11}/> : <TrendingDown size={11}/>}
      {up ? "+" : ""}{pct}%{suffix}
    </span>
  );
}

function StatCard({ label, current, previous, icon, format: fmt = (v: number) => v.toLocaleString(), accent = "blue" }:
  { label: string; current: number; previous: number; icon?: React.ReactNode; format?: (v: number) => string; accent?: string }) {
  const accentMap: Record<string, string> = {
    blue: "text-blue-600", green: "text-green-600", pink: "text-pink-500",
    purple: "text-purple-600", amber: "text-amber-500", indigo: "text-indigo-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500 font-medium">{label}</span>
        {icon && <span className={accentMap[accent] ?? "text-gray-400"}>{icon}</span>}
      </div>
      <p className={`text-2xl font-bold ${accentMap[accent] ?? "text-gray-900"}`}>{fmt(current)}</p>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-xs text-gray-400">vs {fmt(previous)} last month</span>
        <Delta current={current} previous={previous} />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const realYear = new Date().getFullYear();
  const realMonth = new Date().getMonth() + 1;
  const isAtCurrentMonth = selectedYear === realYear && selectedMonth === realMonth;

  function goToPrevMonth() {
    if (selectedMonth === 1) { setSelectedYear(y => y - 1); setSelectedMonth(12); }
    else setSelectedMonth(m => m - 1);
  }
  function goToNextMonth() {
    if (isAtCurrentMonth) return;
    if (selectedMonth === 12) { setSelectedYear(y => y + 1); setSelectedMonth(1); }
    else setSelectedMonth(m => m + 1);
  }

  useEffect(() => {
    fetch("/api/accounts").then((r) => r.json()).then((list: Account[]) => {
      const ig = list.filter((a) => a.instagramId);
      setAccounts(ig);
      if (ig.length > 0) setAccountId(ig[0].id);
    });
  }, []);

  useEffect(() => {
    if (!accountId) return;
    setLoading(true);
    fetch(`/api/analytics/report?accountId=${accountId}&year=${selectedYear}&month=${selectedMonth}`)
      .then((r) => r.json())
      .then((d) => { setReport(d); setLoading(false); });
  }, [accountId, selectedYear, selectedMonth]);

  async function handleRefresh() {
    if (!accountId) return;
    setRefreshing(true);
    await fetch("/api/analytics/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    });
    const res = await fetch(`/api/analytics/report?accountId=${accountId}&year=${selectedYear}&month=${selectedMonth}`);
    setReport(await res.json());
    setRefreshing(false);
  }

  async function handleImportHistory() {
    if (!accountId) return;
    setImporting(true);
    await fetch("/api/analytics/import-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    });
    const res = await fetch(`/api/analytics/report?accountId=${accountId}&year=${selectedYear}&month=${selectedMonth}`);
    setReport(await res.json());
    setImporting(false);
  }

  const cur  = report?.current;
  const prev = report?.previous;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          {report && (
            <p className="text-sm text-gray-500 mt-0.5">
              {MONTH_NAMES[report.period.month - 1]} {report.period.year} vs{" "}
              {MONTH_NAMES[report.prevPeriod.month - 1]} {report.prevPeriod.year}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Month navigator */}
          <div className="flex items-center gap-1 border border-gray-300 rounded-lg px-2 py-1.5 bg-white">
            <button onClick={goToPrevMonth} className="p-0.5 rounded hover:bg-gray-100 text-gray-600">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-gray-700 min-w-[110px] text-center select-none">
              {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </span>
            <button onClick={goToNextMonth} disabled={isAtCurrentMonth} className="p-0.5 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight size={16} />
            </button>
          </div>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select property…</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.pageName}</option>)}
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing || !accountId}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button
            onClick={handleImportHistory}
            disabled={importing || !accountId}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            <RefreshCw size={14} className={importing ? "animate-spin" : ""} />
            {importing ? "Importing…" : "Import History"}
          </button>
          <a
            href={accountId ? `/api/analytics/pdf?accountId=${accountId}&year=${selectedYear}&month=${selectedMonth}` : "#"}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 ${!accountId ? "pointer-events-none opacity-50" : ""}`}
          >
            Download Report
          </a>
        </div>
      </div>

      {!accountId && (
        <div className="text-center py-16 text-gray-400">
          <p>Select a property to view analytics</p>
        </div>
      )}

      {loading && accountId && (
        <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
      )}

      {report && !loading && (
        <>
          {/* ── Post type breakdown ── */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Posts this month</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "Total posts",  cur: cur!.breakdown.total,    prev: prev!.breakdown.total,    icon: <BookOpen size={15}/>,    accent: "blue" },
                { label: "Reels",        cur: cur!.breakdown.reels,    prev: prev!.breakdown.reels,    icon: <Film size={15}/>,        accent: "purple" },
                { label: "Static posts", cur: cur!.breakdown.static,   prev: prev!.breakdown.static,   icon: <Image size={15}/>,       accent: "pink" },
                { label: "Carousels",    cur: cur!.breakdown.carousel, prev: prev!.breakdown.carousel, icon: <LayoutGrid size={15}/>,  accent: "indigo" },
                { label: "Videos",       cur: cur!.breakdown.video,    prev: prev!.breakdown.video,    icon: <Video size={15}/>,       accent: "amber" },
                { label: "Live stories", cur: report.storiesCount,     prev: 0,                        icon: <Users size={15}/>,       accent: "green" },
              ].map(({ label, cur: c, prev: p, icon, accent }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 font-medium">{label}</span>
                    <span className={`${accent === "blue" ? "text-blue-600" : accent === "purple" ? "text-purple-600" : accent === "pink" ? "text-pink-500" : accent === "indigo" ? "text-indigo-600" : accent === "amber" ? "text-amber-500" : "text-green-600"}`}>{icon}</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{c}</p>
                  {label !== "Live stories" ? (
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs text-gray-400">was {p}</span>
                      <Delta current={c} previous={p} />
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 mt-1.5">right now</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Followers ── */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Followers</h2>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-6 flex-wrap">
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1">Total followers</p>
                <p className="text-4xl font-bold text-gray-900">{report.followers.current.toLocaleString()}</p>
              </div>
              <div className="h-12 w-px bg-gray-200 hidden sm:block" />
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1">Change vs last month</p>
                {report.followers.change !== null ? (
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl font-bold ${report.followers.change >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {report.followers.change >= 0 ? "+" : ""}{report.followers.change.toLocaleString()}
                    </span>
                    {report.followers.changePercent !== null && (
                      <span className={`text-sm font-semibold flex items-center gap-1 ${report.followers.change >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {report.followers.change >= 0 ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
                        {report.followers.change >= 0 ? "+" : ""}{report.followers.changePercent}%
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-gray-400 text-sm">
                    <Minus size={14}/> Not enough history yet
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Engagement metrics ── */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Performance vs last month</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="Impressions"     current={cur!.metrics.impressions}     previous={prev!.metrics.impressions}     accent="blue"   />
              <StatCard label="Reach"           current={cur!.metrics.reach}           previous={prev!.metrics.reach}           accent="purple" />
              <StatCard label="Engagement rate" current={cur!.metrics.engagementRate}  previous={prev!.metrics.engagementRate}  accent="green"
                format={(v) => `${v}%`} />
              <StatCard label="Likes"           current={cur!.metrics.likes}           previous={prev!.metrics.likes}           accent="pink"   />
              <StatCard label="Comments"        current={cur!.metrics.comments}        previous={prev!.metrics.comments}        accent="amber"  />
              <StatCard label="Shares"          current={cur!.metrics.shares}          previous={prev!.metrics.shares}          accent="indigo" />
              <StatCard label="Saves"           current={cur!.metrics.saves}           previous={prev!.metrics.saves}           accent="blue"   />
              <StatCard label="Clicks"          current={cur!.metrics.clicks}          previous={prev!.metrics.clicks}          accent="purple" />
            </div>
          </div>

          {/* ── Chart ── */}
          {report.chartData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Daily performance — {MONTH_NAMES[report.period.month - 1]}</h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={report.chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), "d MMM")} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip labelFormatter={(d) => format(new Date(d as string), "d MMM yyyy")} />
                  <Legend />
                  <Bar dataKey="impressions" name="Impressions" fill="#3b82f6" radius={[3,3,0,0]} />
                  <Bar dataKey="reach"       name="Reach"       fill="#8b5cf6" radius={[3,3,0,0]} />
                  <Bar dataKey="likes"       name="Likes"       fill="#ec4899" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Top 5 posts ── */}
          {report.topPosts.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Top 5 best performing posts</h2>
              <div className="space-y-3">
                {report.topPosts.map((post, i) => (
                  <div key={post.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex gap-4 items-start">
                    {/* Rank */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      i === 0 ? "bg-yellow-100 text-yellow-700" :
                      i === 1 ? "bg-gray-100 text-gray-600" :
                      i === 2 ? "bg-orange-100 text-orange-600" : "bg-gray-50 text-gray-400"
                    }`}>
                      {i + 1}
                    </div>
                    {/* Thumbnail */}
                    {(post.thumbnailUrl ?? post.mediaUrl) && (
                      <img src={post.thumbnailUrl ?? post.mediaUrl ?? ""} alt="" className="w-14 h-14 object-cover rounded-lg shrink-0" />
                    )}
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-500 uppercase">{post.mediaType}</span>
                        {post.publishedAt && (
                          <span className="text-xs text-gray-400">{format(new Date(post.publishedAt), "d MMM yyyy")}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">{post.caption}</p>
                    </div>
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-x-4 gap-y-1 shrink-0 text-right">
                      {[
                        { label: "Impressions", value: post.impressions },
                        { label: "Reach",       value: post.reach },
                        { label: "Likes",       value: post.likes },
                        { label: "Comments",    value: post.comments },
                        { label: "Shares",      value: post.shares },
                        { label: "Saves",       value: post.saves },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-xs text-gray-400">{label}</p>
                          <p className="text-sm font-semibold text-gray-900">{value.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {report.topPosts.length === 0 && cur!.breakdown.total === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
              <p className="text-sm font-medium text-amber-800">No data yet for this property</p>
              <p className="text-sm text-amber-600 mt-1">Click <strong>Refresh</strong> to pull metrics from Instagram.</p>
            </div>
          )}

          {/* Highlights note */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-500">
            <strong className="text-gray-700">Note on Highlights:</strong> Instagram's API does not expose Highlights data — whether they've been changed can only be checked manually on the Instagram app.
          </div>
        </>
      )}
    </div>
  );
}
