import { NextResponse } from "next/server";
import { processScheduledPosts } from "@/lib/scheduler";

// Called by Vercel Cron every minute — secured by CRON_SECRET header
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await processScheduledPosts();
  return NextResponse.json({ ok: true });
}
