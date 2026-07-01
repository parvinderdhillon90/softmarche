import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { monthlyPostTarget } = await req.json();

  if (typeof monthlyPostTarget !== "number" || monthlyPostTarget < 1) {
    return NextResponse.json({ error: "Invalid target" }, { status: 400 });
  }

  const updated = await prisma.account.update({
    where: { id },
    data: { monthlyPostTarget },
    select: { id: true, monthlyPostTarget: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Collect post IDs so we can delete their analytics first
  const posts = await prisma.post.findMany({ where: { accountId: id }, select: { id: true } });
  const postIds = posts.map((p) => p.id);

  await prisma.$transaction([
    prisma.analytics.deleteMany({ where: { postId: { in: postIds } } }),
    prisma.post.deleteMany({ where: { accountId: id } }),
    prisma.followerSnapshot.deleteMany({ where: { accountId: id } }),
    prisma.accountSyncLog.deleteMany({ where: { accountId: id } }),
    prisma.account.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
