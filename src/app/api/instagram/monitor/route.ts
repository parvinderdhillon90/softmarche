import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getInstagramMediaForMonth,
  getInstagramAccountInfo,
} from "@/lib/meta";
import {
  getDaysInMonth,
  format,
  isToday,
  startOfDay,
} from "date-fns";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));

  if (!accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account?.instagramId) {
    return NextResponse.json({ error: "No Instagram account linked" }, { status: 404 });
  }

  const [media, info, scheduledPosts] = await Promise.all([
    getInstagramMediaForMonth(account.instagramId, account.accessToken, year, month),
    getInstagramAccountInfo(account.instagramId, account.accessToken),
    prisma.post.findMany({
      where: {
        accountId,
        platform: "INSTAGRAM",
        status: { in: ["SCHEDULED", "DRAFT"] },
        scheduledAt: {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year, month, 1),
        },
      },
      select: { id: true, scheduledAt: true, status: true, caption: true },
    }),
  ]);

  const daysInMonth = getDaysInMonth(new Date(year, month - 1));

  // Build day-by-day status map
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const date = new Date(year, month - 1, day);
    const dateStr = format(date, "yyyy-MM-dd");

    const published = media.filter(
      (m) => format(new Date(m.timestamp), "yyyy-MM-dd") === dateStr
    );
    const scheduled = scheduledPosts.filter(
      (p) => p.scheduledAt && format(new Date(p.scheduledAt), "yyyy-MM-dd") === dateStr
    );

    const isPast = startOfDay(date) < startOfDay(new Date());
    const isTodayFlag = isToday(date);

    let status: "published" | "scheduled" | "missed" | "today-done" | "today-pending" | "future";
    if (isTodayFlag) {
      status = published.length > 0 ? "today-done" : "today-pending";
    } else if (isPast) {
      status = published.length > 0 ? "published" : "missed";
    } else {
      status = scheduled.length > 0 ? "scheduled" : "future";
    }

    return {
      day,
      date: dateStr,
      isToday: isTodayFlag,
      status,
      publishedCount: published.length,
      scheduledCount: scheduled.length,
      posts: published.map((m) => ({
        id: m.id,
        time: format(new Date(m.timestamp), "HH:mm"),
        type: m.media_type,
        permalink: m.permalink,
        caption: m.caption?.slice(0, 80),
        thumbnail: m.thumbnail_url ?? m.media_url,
      })),
      scheduled: scheduled.map((p) => ({
        id: p.id,
        time: p.scheduledAt ? format(new Date(p.scheduledAt), "HH:mm") : null,
        caption: p.caption?.slice(0, 80),
        status: p.status,
      })),
    };
  });

  const todayPosted = days.find((d) => d.isToday)?.publishedCount ?? 0;
  const monthTotal = media.length;
  const missedDays = days.filter((d) => d.status === "missed").length;
  const scheduledTotal = scheduledPosts.length;

  return NextResponse.json({
    account: {
      username: info.username,
      profilePicture: info.profile_picture_url,
      followers: info.followers_count,
    },
    summary: {
      monthTotal,
      todayPosted,
      missedDays,
      scheduledTotal,
      month,
      year,
    },
    days,
  });
}
