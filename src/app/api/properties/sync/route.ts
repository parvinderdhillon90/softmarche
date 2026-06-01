import { NextResponse } from "next/server";
import { syncAllAccounts } from "@/lib/syncAccounts";

export async function POST() {
  await syncAllAccounts();
  return NextResponse.json({ ok: true });
}
