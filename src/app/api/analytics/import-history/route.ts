import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getInstagramMediaForMonth } from "@/lib/meta";

function mapMediaType(igType: string): "IMAGE" | "VIDEO" | "CAROUSEL" | "REEL" {
  if (igType === "VIDEO") return "VIDEO";
  if (igType === "CAROUSEL_ALBUM") return "CAROUSEL";
  if (igType === "REELS") return "REEL";
  return "IMAGE";
}

export async function POST(req: Request) {
  const { accountId } = await req.json();
  if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { instagramId: true, accessToken: true },
  });
  if (!account?.instagramId) return NextResponse.json({ error: "No Instagram account linked" }, { status: 404 });

  const now = new Date();
  let imported = 0;

  // Import last 2 months of history
  for (let offset = 1; offset <= 2; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;

    try {
      const media = await getInstagramMediaForMonth(account.instagramId, account.accessToken, year, month);
      for (const item of media) {
        const existing = await prisma.post.findFirst({ where: { externalId: item.id } });
        if (!existing) {
          await prisma.post.create({
            data: {
              accountId,
              platform: "INSTAGRAM",
              status: "PUBLISHED",
              caption: item.caption ?? "",
              mediaUrls: item.media_url ? [item.media_url] : [],
              mediaType: mapMediaType(item.media_type),
              publishedAt: new Date(item.timestamp),
              externalId: item.id,
              thumbnailUrl: item.thumbnail_url ?? item.media_url ?? null,
            },
          });
          imported++;
        } else if (!existing.thumbnailUrl) {
          await prisma.post.update({
            where: { id: existing.id },
            data: { thumbnailUrl: item.thumbnail_url ?? item.media_url ?? null },
          });
        }
      }
    } catch {
      // Skip months that fail (API may not have data that far back)
    }
  }

  return NextResponse.json({ ok: true, imported });
}
