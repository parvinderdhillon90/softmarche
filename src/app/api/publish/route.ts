import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishFacebookPost, publishInstagramPost } from "@/lib/meta";
import { PostStatus } from "@prisma/client";

// Publish immediately or trigger scheduled batch
export async function POST(req: Request) {
  const { postId } = await req.json();

  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: { account: true },
  });

  try {
    let externalId: string;

    if (post.platform === "FACEBOOK") {
      externalId = await publishFacebookPost(
        post.account.pageId,
        post.account.accessToken,
        post.caption,
        post.mediaUrls
      );
    } else {
      if (!post.account.instagramId) {
        return NextResponse.json({ error: "No Instagram account linked to this page" }, { status: 400 });
      }
      externalId = await publishInstagramPost(
        post.account.instagramId,
        post.account.accessToken,
        post.caption,
        post.mediaUrls,
        post.mediaType as "IMAGE" | "VIDEO" | "CAROUSEL" | "REEL"
      );
    }

    const updated = await prisma.post.update({
      where: { id: postId },
      data: { status: PostStatus.PUBLISHED, publishedAt: new Date(), externalId },
    });

    return NextResponse.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.post.update({
      where: { id: postId },
      data: { status: PostStatus.FAILED, errorMsg: msg },
    });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
