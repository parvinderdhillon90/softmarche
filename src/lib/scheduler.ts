import { prisma } from "./prisma";
import { publishFacebookPost, publishInstagramPost } from "./meta";
import { PostStatus } from "@prisma/client";

export async function processScheduledPosts() {
  const due = await prisma.post.findMany({
    where: {
      status: PostStatus.SCHEDULED,
      scheduledAt: { lte: new Date() },
    },
    include: { account: true },
  });

  await Promise.allSettled(
    due.map(async (post) => {
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
          if (!post.account.instagramId) throw new Error("No Instagram account linked");
          externalId = await publishInstagramPost(
            post.account.instagramId,
            post.account.accessToken,
            post.caption,
            post.mediaUrls,
            post.mediaType as "IMAGE" | "VIDEO" | "CAROUSEL" | "REEL"
          );
        }

        await prisma.post.update({
          where: { id: post.id },
          data: { status: PostStatus.PUBLISHED, publishedAt: new Date(), externalId },
        });
      } catch (err) {
        await prisma.post.update({
          where: { id: post.id },
          data: {
            status: PostStatus.FAILED,
            errorMsg: err instanceof Error ? err.message : String(err),
          },
        });
      }
    })
  );
}
