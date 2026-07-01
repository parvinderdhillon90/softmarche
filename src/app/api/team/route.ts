import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const members = await prisma.teamMember.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      assignments: { select: { accountId: true } },
    },
  });

  return NextResponse.json(
    members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      createdAt: m.createdAt,
      accountIds: m.assignments.map((a) => a.accountId),
    }))
  );
}

export async function POST(req: Request) {
  const { name, email, role } = await req.json();
  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  const member = await prisma.teamMember.create({
    data: { name: name.trim(), email: email.trim().toLowerCase(), role: role === "ADMIN" ? "ADMIN" : "MEMBER" },
  });

  return NextResponse.json({ ...member, accountIds: [] }, { status: 201 });
}
