import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserPages, getLongLivedToken } from "@/lib/meta";
import { Platform } from "@prisma/client";

export async function GET() {
  const accounts = await prisma.account.findMany({
    select: { id: true, platform: true, pageId: true, pageName: true, tokenExpiresAt: true, instagramId: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(accounts);
}

// Connect a Meta page — body: { shortToken: string }
export async function POST(req: Request) {
  const { shortToken } = await req.json();

  const { access_token: userToken } = await getLongLivedToken(shortToken);
  const pages = await getUserPages(userToken);

  const created = await Promise.all(
    pages.map(async (page) => {
      // Exchange page token for long-lived page token
      const { access_token: pageToken, expires_in } = await getLongLivedToken(page.access_token);
      const expiresAt = new Date(Date.now() + expires_in * 1000);

      return prisma.account.upsert({
        where: { platform_pageId: { platform: Platform.FACEBOOK, pageId: page.id } },
        create: {
          platform: Platform.FACEBOOK,
          pageId: page.id,
          pageName: page.name,
          accessToken: pageToken,
          tokenExpiresAt: expiresAt,
          instagramId: page.instagram_business_account?.id ?? null,
        },
        update: {
          pageName: page.name,
          accessToken: pageToken,
          tokenExpiresAt: expiresAt,
          instagramId: page.instagram_business_account?.id ?? null,
        },
      });
    })
  );

  return NextResponse.json(created, { status: 201 });
}
