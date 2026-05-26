import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PostStatus } from "@prisma/client";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const updated = await prisma.post.update({
    where: { id },
    data: {
      caption: body.caption,
      mediaUrls: body.mediaUrls,
      mediaType: body.mediaType,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
      status: body.scheduledAt ? PostStatus.SCHEDULED : body.status,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.post.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
