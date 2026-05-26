"use client";

import { useState, useEffect } from "react";
import { Eye, Users, Heart, MessageSquare, Share2, Bookmark, MousePointerClick } from "lucide-react";
import { MetricCard } from "@/components/analytics/MetricCard";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Post } from "@/types";
import { format } from "date-fns";

interface AnalyticsSummary {
  totals: {
    impressions: number;
    reach: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    clicks: number;
  };
  posts: Post[];
  postCount: number;
}

const METRICS = [
  { key: "impressions" as const, label: "Impressions", icon: <Eye size={16} /> },
  { key: "reach" as const, label: "Reach", icon: <Users size={16} /> },
  { key: "likes" as const, label: "Likes", icon: <Heart size={16} /> },
  { key: "comments" as const, label: "Comments", icon: <MessageSquare size={16} /> },
  { key: "shares" as const, label: "Shares", icon: <Share2 size={16} /> },
  { key: "saves" as const, label: "Saves", icon: <Bookmark size={16} /> },
  { key: "clicks" as const, label: "Clicks", icon: <MousePointerClick size={16} /> },
];

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [platform, setPlatform] = useState<"" | "FACEBOOK" | "INSTAGRAM">("");
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const url = `/api/analytics?days=${days}${platform ? `&platform=${platform}` : ""}`;
    fetch(url).then((r) => r.json()).then(setData);
  }, [days, platform]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetch("/api/analytics", { method: "POST" });
    const url = `/api/analytics?days=${days}${platform ? `&platform=${platform}` : ""}`;
    const res = await fetch(url);
    setData(await res.json());
    setRefreshing(false);
  }

  const chartData = (data?.posts ?? [])
    .filter((p) => p.analytics)
    .map((p) => ({
      date: format(new Date(p.publishedAt!), "MMM d"),
      Impressions: p.analytics!.impressions,
      Reach: p.analytics!.reach,
      Likes: p.analytics!.likes,
    }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <div className="flex items-center gap-3">
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as typeof platform)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All platforms</option>
            <option value="FACEBOOK">Facebook</option>
            <option value="INSTAGRAM">Instagram</option>
          </select>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {METRICS.map(({ key, label, icon }) => (
          <MetricCard key={key} label={label} value={data?.totals[key] ?? 0} icon={icon} />
        ))}
        <MetricCard label="Posts" value={data?.postCount ?? 0} />
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Performance over time</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Impressions" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Reach" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Likes" fill="#ec4899" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Post table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Platform", "Caption", "Published", "Impressions", "Reach", "Likes", "Comments"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(data?.posts ?? []).map((post) => (
              <tr key={post.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600">{post.platform}</td>
                <td className="px-4 py-3 text-gray-900 max-w-xs truncate">{post.caption}</td>
                <td className="px-4 py-3 text-gray-500">{post.publishedAt ? format(new Date(post.publishedAt), "MMM d, yyyy") : "—"}</td>
                <td className="px-4 py-3">{post.analytics?.impressions.toLocaleString() ?? "—"}</td>
                <td className="px-4 py-3">{post.analytics?.reach.toLocaleString() ?? "—"}</td>
                <td className="px-4 py-3">{post.analytics?.likes.toLocaleString() ?? "—"}</td>
                <td className="px-4 py-3">{post.analytics?.comments.toLocaleString() ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(data?.posts ?? []).length === 0 && (
          <p className="text-center text-sm text-gray-400 py-10">No published posts in this period.</p>
        )}
      </div>
    </div>
  );
}
