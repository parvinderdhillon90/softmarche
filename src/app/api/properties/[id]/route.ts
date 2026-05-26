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
