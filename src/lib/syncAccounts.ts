import { prisma } from "./prisma";
import { getInstagramMediaForMonth, getInstagramAccountInfo, getInstagramStoriesCount } from "./meta";

export async function syncAllAccounts() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const accounts = await prisma.account.findMany({
    where: { instagramId: { not: null } },
    select: { id: true, instagramId: true, accessToken: true },
  });

  const BATCH = 5;
  for (let i = 0; i < accounts.length; i += BATCH) {
    const batch = accounts.slice(i, i + BATCH);
    await Promise.allSettled(batch.map((a) => syncOneAccount(a, year, month)));
    if (i + BATCH < accounts.length) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

function mapMediaType(igType: string): "IMAGE" | "VIDEO" | "CAROUSEL" | "REEL" {
  if (igType === "VIDEO") return "VIDEO";
  if (igType === "CAROUSEL_ALBUM") return "CAROUSEL";
  if (igType === "REELS") return "REEL";
  return "IMAGE";
}

async function syncOneAccount(
  account: { id: string; instagramId: string | null; accessToken: string },
  year: number,
  month: number
) {
  try {
    const [media, info, scheduledCount, storiesCount] = await Promise.all([
      getInstagramMediaForMonth(account.instagramId!, account.accessToken, year, month),
      getInstagramAccountInfo(account.instagramId!, account.accessToken),
      prisma.post.count({
        where: {
          accountId: account.id,
          platform: "INSTAGRAM",
          status: { in: ["SCHEDULED", "DRAFT"] },
          scheduledAt: {
            gte: new Date(year, month - 1, 1),
            lt: new Date(year, month, 1),
          },
        },
      }),
      getInstagramStoriesCount(account.instagramId!, account.accessToken),
    ]);

    // Import Instagram posts into our Post table so analytics can track them
    for (const item of media) {
      const existing = await prisma.post.findFirst({ where: { externalId: item.id } });
      if (!existing) {
        await prisma.post.create({
          data: {
            accountId: account.id,
            platform: "INSTAGRAM",
            status: "PUBLISHED",
            caption: item.caption ?? "",
            mediaUrls: item.media_url ? [item.media_url] : [],
            mediaType: mapMediaType(item.media_type),
            publishedAt: new Date(item.timestamp),
            externalId: item.id,
          },
        });
      }
    }

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const daysElapsed = today.getDate();
    const postedDates = new Set(media.map((m) => m.timestamp.slice(0, 10)));

    let missedDays = 0;
    for (let d = 1; d < daysElapsed; d++) {
      const ds = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (!postedDates.has(ds)) missedDays++;
    }

    const todayPosted = media.filter((m) => m.timestamp.slice(0, 10) === todayStr).length;

    // Save daily follower snapshot (once per day max)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const existingSnapshot = await prisma.followerSnapshot.findFirst({
      where: { accountId: account.id, date: { gte: todayStart } },
    });
    if (!existingSnapshot) {
      await prisma.followerSnapshot.create({
        data: { accountId: account.id, followers: info.followers_count },
      });
    }

    await prisma.account.update({
      where: { id: account.id },
      data: {
        cachedMonthTotal: media.length,
        cachedMissedDays: missedDays,
        cachedTodayPosted: todayPosted,
        cachedScheduled: scheduledCount,
        cachedSyncMonth: month,
        cachedSyncYear: year,
        cachedStoriesCount: storiesCount,
        username: info.username,
        followers: info.followers_count,
        lastSyncAt: new Date(),
      },
    });

    await prisma.accountSyncLog.create({
      data: { accountId: account.id, success: true },
    });
  } catch (err) {
    await prisma.accountSyncLog.create({
      data: {
        accountId: account.id,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }
}
