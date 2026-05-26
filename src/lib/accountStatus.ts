export type AccountStatus = "red" | "amber" | "green" | "blue";

export function computeAccountStatus(account: {
  cachedMonthTotal: number;
  cachedMissedDays: number;
  cachedTodayPosted: number;
  monthlyPostTarget: number;
  lastSyncAt: Date | null;
}): AccountStatus {
  const { cachedMonthTotal, cachedMissedDays, cachedTodayPosted, monthlyPostTarget } = account;

  if (!account.lastSyncAt) return "red"; // never synced

  const pct = monthlyPostTarget > 0 ? cachedMonthTotal / monthlyPostTarget : 0;

  if (pct >= 1.0) return "blue";              // target reached
  if (cachedMissedDays > 0 || cachedTodayPosted === 0) return "red"; // issues
  if (pct >= 0.9) return "amber";             // within 10% of target
  return "green";                             // on track
}

export const STATUS_CONFIG: Record<AccountStatus, { label: string; bg: string; border: string; text: string; ring: string }> = {
  red:   { label: "Issues",       bg: "bg-red-50",   border: "border-red-300",   text: "text-red-700",   ring: "ring-red-400" },
  amber: { label: "Near target",  bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700", ring: "ring-amber-400" },
  green: { label: "On track",     bg: "bg-green-50", border: "border-green-300", text: "text-green-700", ring: "ring-green-400" },
  blue:  { label: "Target met",   bg: "bg-blue-50",  border: "border-blue-300",  text: "text-blue-700",  ring: "ring-blue-400" },
};
