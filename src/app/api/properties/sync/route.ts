import { NextResponse } from "next/server";
import { syncAllAccounts } from "@/lib/syncAccounts";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await syncAllAccounts();
  return NextResponse.json({ ok: true });
}
