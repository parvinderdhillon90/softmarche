import { NextResponse } from "next/server";
import { processScheduledPosts } from "@/lib/scheduler";
import { syncAllAccounts } from "@/lib/syncAccounts";

// Called by Vercel Cron every minute — secured by CRON_SECRET header
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await processScheduledPosts();

  // Sync Instagram stats once per hour (when minute === 0)
  if (new Date().getMinutes() === 0) {
    syncAllAccounts().catch(console.error); // fire-and-forget; don't block the cron response
  }

  return NextResponse.json({ ok: true });
}
