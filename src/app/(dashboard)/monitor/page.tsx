"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock, Calendar, AlertCircle } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { Account } from "@/types";

interface DayData {
  day: number;
  date: string;
  isToday: boolean;
  status: "published" | "scheduled" | "missed" | "today-done" | "today-pending" | "future";
  publishedCount: number;
  scheduledCount: number;
  posts: { id: string; time: string; type: string; permalink: string; caption?: string; thumbnail?: string }[];
  scheduled: { id: string; time: string | null; caption?: string; status: string }[];
}

interface MonitorData {
  account: { username: string; profilePicture?: string; followers: number };
  summary: { monthTotal: number; todayPosted: number; missedDays: number; scheduledTotal: number; month: number; year: number };
  days: DayData[];
}

const STATUS_STYLE: Record<DayData["status"], { bg: string; border: string; dot: string; label: string }> = {
  "today-done":    { bg: "bg-green-50",  border: "border-green-400", dot: "bg-green-500",  label: "Posted today" },
  "today-pending": { bg: "bg-amber-50",  border: "border-amber-400", dot: "bg-amber-500",  label: "Not posted yet" },
  published:       { bg: "bg-green-50",  border: "border-green-200", dot: "bg-green-400",  label: "Posted" },
  missed:          { bg: "bg-red-50",    border: "border-red-200",   dot: "bg-red-400",    label: "Missed" },
  scheduled:       { bg: "bg-blue-50",   border: "border-blue-200",  dot: "bg-blue-400",   label: "Scheduled" },
  future:          { bg: "bg-gray-50",   border: "border-gray-200",  dot: "bg-gray-300",   label: "No post" },
};

export default function MonitorPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [month, setMonth] = useState(new Date());
  const [data, setData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((list: Account[]) => {
        const igAccounts = list.filter((a) => a.instagramId);
        setAccounts(igAccounts);
        if (igAccounts.length > 0) setSelectedId(igAccounts[0].id);
      });
  }, []);

  const load = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/instagram/monitor?accountId=${selectedId}&year=${month.getFullYear()}&month=${month.getMonth() + 1}`
      );
      if (!res.ok) throw new Error((await res.json()).error);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [selectedId, month]);

  useEffect(() => { load(); }, [load]);

  const today = data?.days.find((d) => d.isToday);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Post Monitor</h1>
          {data && (
            <p className="text-sm text-gray-500 mt-0.5">
              @{data.account.username} · {data.account.followers.toLocaleString()} followers
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {accounts.length > 1 && (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.pageName}</option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
            <button onClick={() => setMonth(subMonths(month, 1))} className="hover:text-blue-600">
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-medium w-28 text-center">{format(month, "MMMM yyyy")}</span>
            <button onClick={() => setMonth(addMonths(month, 1))} className="hover:text-blue-600">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {!selectedId && !loading && (
        <div className="text-center py-16 text-gray-400">
          <Calendar size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No Instagram accounts connected</p>
          <p className="text-sm mt-1">Go to <strong>Accounts</strong> in the sidebar to connect one.</p>
        </div>
      )}

      {loading && (
        <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
      )}

      {data && !loading && (
        <>
          {/* Today's status — big prominent card */}
          {today && (
            <div className={`rounded-2xl border-2 p-5 flex items-center gap-5 ${
              today.status === "today-done"
                ? "bg-green-50 border-green-400"
                : "bg-amber-50 border-amber-400"
            }`}>
              {today.status === "today-done" ? (
                <CheckCircle2 size={40} className="text-green-500 shrink-0" />
              ) : (
                <XCircle size={40} className="text-amber-500 shrink-0" />
              )}
              <div>
                <p className="text-lg font-bold text-gray-900">
                  {today.status === "today-done"
                    ? `Today's post is done ✓`
                    : "No post published today yet"}
                </p>
                <p className="text-sm text-gray-600 mt-0.5">
                  {today.status === "today-done"
                    ? `${today.publishedCount} post${today.publishedCount > 1 ? "s" : ""} published today · ${today.posts[0]?.time}`
                    : today.scheduledCount > 0
                    ? `${today.scheduledCount} post${today.scheduledCount > 1 ? "s" : ""} scheduled for later today`
                    : "Nothing scheduled for today"}
                </p>
              </div>
            </div>
          )}

          {/* Summary row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Posts this month", value: data.summary.monthTotal, color: "text-blue-600" },
              { label: "Missed days",       value: data.summary.missedDays,  color: "text-red-500" },
              { label: "Scheduled ahead",   value: data.summary.scheduledTotal, color: "text-indigo-600" },
              { label: "Today posted",      value: data.summary.todayPosted,  color: data.summary.todayPosted > 0 ? "text-green-600" : "text-amber-500" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <p className="text-xs text-gray-500 font-medium">{label}</p>
                <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Day-by-day grid */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Day-by-day status</h2>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                {(["today-done", "published", "missed", "scheduled", "future"] as const).map((s) => (
                  <span key={s} className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${STATUS_STYLE[s].dot}`} />
                    {STATUS_STYLE[s].label}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-7 gap-px bg-gray-100">
              {/* Day-of-week headers */}
              {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
                <div key={d} className="bg-white py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  {d}
                </div>
              ))}

              {/* Empty cells before day 1 */}
              {(() => {
                const firstDow = (new Date(data.summary.year, data.summary.month - 1, 1).getDay() + 6) % 7;
                return Array.from({ length: firstDow }, (_, i) => (
                  <div key={`pad-${i}`} className="bg-gray-50" />
                ));
              })()}

              {data.days.map((d) => {
                const style = STATUS_STYLE[d.status];
                return (
                  <button
                    key={d.day}
                    onClick={() => setSelectedDay(d)}
                    className={`${style.bg} border ${style.border} ${
                      d.isToday ? "ring-2 ring-offset-1 ring-blue-400" : ""
                    } p-2 min-h-[72px] text-left hover:opacity-80 transition-opacity relative`}
                  >
                    <span className={`text-xs font-bold ${d.isToday ? "text-blue-600" : "text-gray-700"}`}>
                      {d.day}
                    </span>
                    <span className={`absolute top-2 right-2 w-2 h-2 rounded-full ${style.dot}`} />
                    {d.publishedCount > 0 && (
                      <p className="text-xs text-gray-600 mt-1 leading-tight">
                        {d.publishedCount} post{d.publishedCount > 1 ? "s" : ""}
                      </p>
                    )}
                    {d.scheduledCount > 0 && d.publishedCount === 0 && (
                      <p className="text-xs text-blue-500 mt-1 leading-tight flex items-center gap-0.5">
                        <Clock size={10} /> {d.scheduledCount} sched.
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Day detail panel */}
      {selectedDay && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">
                  {format(new Date(selectedDay.date), "EEEE, MMMM d")}
                </h3>
                <p className={`text-xs mt-0.5 font-medium ${STATUS_STYLE[selectedDay.status].dot.replace("bg-", "text-")}`}>
                  {STATUS_STYLE[selectedDay.status].label}
                </p>
              </div>
              <button onClick={() => setSelectedDay(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-4">
              {selectedDay.posts.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Published</p>
                  {selectedDay.posts.map((p) => (
                    <a
                      key={p.id}
                      href={p.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors mb-2"
                    >
                      {p.thumbnail && (
                        <img src={p.thumbnail} alt="" className="w-12 h-12 object-cover rounded-md shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">{p.time} · {p.type}</p>
                        {p.caption && <p className="text-sm text-gray-700 mt-0.5 line-clamp-2">{p.caption}</p>}
                      </div>
                    </a>
                  ))}
                </div>
              )}

              {selectedDay.scheduled.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Scheduled</p>
                  {selectedDay.scheduled.map((p) => (
                    <div key={p.id} className="p-3 rounded-lg border border-blue-200 bg-blue-50 mb-2">
                      <p className="text-xs text-blue-500">{p.time} · {p.status}</p>
                      {p.caption && <p className="text-sm text-gray-700 mt-0.5 line-clamp-2">{p.caption}</p>}
                    </div>
                  ))}
                </div>
              )}

              {selectedDay.posts.length === 0 && selectedDay.scheduled.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No posts for this day.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
