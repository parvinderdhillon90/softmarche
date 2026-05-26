"use client";

import { useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { Post } from "@/types";
import { StatusBadge, PlatformBadge } from "@/components/ui/Badge";

interface Props {
  month: Date;
  posts: Post[];
  onDayClick: (date: Date) => void;
  onPostClick: (post: Post) => void;
}

export function CalendarGrid({ month, posts, onDayClick, onPostClick }: Props) {
  const days = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    // Pad to start on Monday
    const paddedStart = new Date(start);
    const dow = (start.getDay() + 6) % 7; // Mon=0
    paddedStart.setDate(paddedStart.getDate() - dow);
    return eachDayOfInterval({ start: paddedStart, end });
  }, [month]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const p of posts) {
      const key = p.scheduledAt
        ? format(new Date(p.scheduledAt), "yyyy-MM-dd")
        : format(new Date(p.createdAt), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [posts]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayPosts = postsByDay.get(key) ?? [];
          const isCurrentMonth = day.getMonth() === month.getMonth();

          return (
            <div
              key={key}
              onClick={() => onDayClick(day)}
              className={`min-h-[110px] p-2 border-b border-r border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors ${
                !isCurrentMonth ? "bg-gray-50" : ""
              }`}
            >
              <span
                className={`text-sm font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                  isToday(day)
                    ? "bg-blue-600 text-white"
                    : isCurrentMonth
                    ? "text-gray-900"
                    : "text-gray-400"
                }`}
              >
                {format(day, "d")}
              </span>

              <div className="mt-1 space-y-1">
                {dayPosts.slice(0, 3).map((post) => (
                  <button
                    key={post.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPostClick(post);
                    }}
                    className="w-full text-left"
                  >
                    <div className="bg-white border border-gray-200 rounded px-1.5 py-0.5 flex items-center gap-1 hover:border-blue-400 transition-colors">
                      <PlatformBadge platform={post.platform} />
                      <span className="text-xs text-gray-700 truncate flex-1">{post.caption.slice(0, 30)}</span>
                      <StatusBadge status={post.status} />
                    </div>
                  </button>
                ))}
                {dayPosts.length > 3 && (
                  <p className="text-xs text-gray-400 pl-1">+{dayPosts.length - 3} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
