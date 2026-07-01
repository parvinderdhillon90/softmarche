"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Search, Building2, CheckCircle2, AlertCircle, Clock, ChevronRight, Trash2 } from "lucide-react";
import { AccountStatus, STATUS_CONFIG } from "@/lib/accountStatus";
import { formatDistanceToNow } from "date-fns";

interface PropertySummary {
  id: string;
  pageName: string;
  username: string | null;
  followers: number;
  monthlyPostTarget: number;
  cachedMonthTotal: number;
  cachedMissedDays: number;
  cachedTodayPosted: number;
  cachedScheduled: number;
  cachedSyncMonth: number | null;
  cachedSyncYear: number | null;
  lastSyncAt: string | null;
  status: AccountStatus;
}

const STATUS_ORDER: AccountStatus[] = ["red", "amber", "green", "blue"];

export default function PropertiesPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AccountStatus | "all">("all");
  const [syncing, setSyncing] = useState(false);
  const [editingTarget, setEditingTarget] = useState<{ id: string; value: number } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);
  const [members, setMembers] = useState<{ id: string; name: string; accountIds: string[] }[]>([]);
  const [selectedMember, setSelectedMember] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/properties");
    const data = await res.json();
    // Sort: red first, then amber, green, blue; then alphabetically
    data.sort((a: PropertySummary, b: PropertySummary) => {
      const oi = STATUS_ORDER.indexOf(a.status);
      const oj = STATUS_ORDER.indexOf(b.status);
      if (oi !== oj) return oi - oj;
      return a.pageName.localeCompare(b.pageName);
    });
    setProperties(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/team").then(r => r.json()).then(setMembers);
  }, []);

  async function handleSyncAll() {
    setSyncing(true);
    try {
      await fetch("/api/properties/sync", { method: "POST" });
      await load();
    } finally {
      setSyncing(false);
    }
  }

  async function handleRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    await fetch(`/api/properties/${removeTarget.id}`, { method: "DELETE" });
    setProperties((prev) => prev.filter((p) => p.id !== removeTarget.id));
    setRemoveTarget(null);
    setRemoving(false);
  }

  async function saveTarget(id: string, value: number) {
    await fetch(`/api/properties/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyPostTarget: value }),
    });
    setProperties((prev) =>
      prev.map((p) => (p.id === id ? { ...p, monthlyPostTarget: value } : p))
    );
    setEditingTarget(null);
  }

  const activeMember = members.find(m => m.id === selectedMember);

  const filtered = properties.filter((p) => {
    const matchSearch =
      p.pageName.toLowerCase().includes(search.toLowerCase()) ||
      (p.username ?? "").toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || p.status === filter;
    const matchMember = !activeMember || activeMember.accountIds.includes(p.id);
    return matchSearch && matchFilter && matchMember;
  });

  const counts = {
    red:   properties.filter((p) => p.status === "red").length,
    amber: properties.filter((p) => p.status === "amber").length,
    green: properties.filter((p) => p.status === "green").length,
    blue:  properties.filter((p) => p.status === "blue").length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Properties</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeMember ? `${filtered.length} properties — ${activeMember.name}` : `${properties.length} hotel accounts`}
          </p>
        </div>
        <button
          onClick={handleSyncAll}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Syncing all…" : "Refresh All"}
        </button>
      </div>

      {/* Status filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            filter === "all" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
          }`}
        >
          All ({properties.length})
        </button>
        {(["red", "amber", "green", "blue"] as const).map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filter === s ? `${cfg.bg} ${cfg.border} ${cfg.text}` : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
              }`}
            >
              {cfg.label} ({counts[s]})
            </button>
          );
        })}

        {/* Member filter */}
        {members.length > 0 && (
          <select
            value={selectedMember}
            onChange={(e) => setSelectedMember(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All members</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.name} ({m.accountIds.length})</option>
            ))}
          </select>
        )}

        {/* Search */}
        <div className="ml-auto flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-1.5">
          <Search size={14} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search properties…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm outline-none w-44"
          />
        </div>
      </div>

      {/* Summary bar */}
      {counts.red > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} />
          <strong>{counts.red} {counts.red === 1 ? "property needs" : "properties need"} attention</strong>
          {" "}— missed posts or today's post not done
        </div>
      )}

      {/* Property grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p>No properties found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map((p) => {
            const cfg = STATUS_CONFIG[p.status];
            const pct = p.monthlyPostTarget > 0 ? Math.min(p.cachedMonthTotal / p.monthlyPostTarget, 1) : 0;
            const isEditing = editingTarget?.id === p.id;

            return (
              <div
                key={p.id}
                className={`bg-white rounded-xl border-2 ${cfg.border} shadow-sm hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden`}
                onClick={() => router.push(`/monitor?accountId=${p.id}`)}
              >
                {/* Coloured left stripe */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                  p.status === "red" ? "bg-red-400" :
                  p.status === "amber" ? "bg-amber-400" :
                  p.status === "green" ? "bg-green-400" : "bg-blue-400"
                }`} />

                <div className="pl-4 pr-4 pt-4 pb-3">
                  {/* Top row: name + status badge + remove button */}
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{p.pageName}</p>
                      {p.username && (
                        <p className="text-xs text-gray-400 mt-0.5">@{p.username}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setRemoveTarget({ id: p.id, name: p.pageName }); }}
                        className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Remove property"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Today status */}
                  <div className="flex items-center gap-1.5 mt-2 mb-3">
                    {p.cachedTodayPosted > 0 ? (
                      <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                    ) : (
                      <AlertCircle size={14} className="text-red-400 shrink-0" />
                    )}
                    <span className="text-xs text-gray-600">
                      {p.cachedTodayPosted > 0 ? "Today's post done" : "No post today yet"}
                    </span>
                    {p.cachedScheduled > 0 && (
                      <span className="ml-auto text-xs text-blue-500 flex items-center gap-0.5">
                        <Clock size={11} /> {p.cachedScheduled} scheduled
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="mb-1.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">Posts this month</span>
                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => { e.stopPropagation(); setEditingTarget({ id: p.id, value: p.monthlyPostTarget }); }}
                      >
                        <span className="text-xs font-semibold text-gray-900">{p.cachedMonthTotal}</span>
                        <span className="text-xs text-gray-400">/</span>
                        {isEditing ? (
                          <input
                            type="number"
                            value={editingTarget!.value}
                            onChange={(e) => setEditingTarget({ id: p.id, value: parseInt(e.target.value) || 0 })}
                            onBlur={() => saveTarget(p.id, editingTarget!.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") saveTarget(p.id, editingTarget!.value); if (e.key === "Escape") setEditingTarget(null); }}
                            className="w-10 text-xs border border-blue-400 rounded px-1 text-center outline-none"
                            autoFocus
                            min={1}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className="text-xs text-gray-400 underline decoration-dotted cursor-pointer hover:text-blue-600">
                            {p.monthlyPostTarget}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          p.status === "blue" ? "bg-blue-500" :
                          p.status === "green" ? "bg-green-500" :
                          p.status === "amber" ? "bg-amber-500" : "bg-red-400"
                        }`}
                        style={{ width: `${pct * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Missed days + last sync */}
                  <div className="flex items-center justify-between mt-2">
                    {p.cachedMissedDays > 0 ? (
                      <span className="text-xs font-medium text-red-600">
                        {p.cachedMissedDays} day{p.cachedMissedDays > 1 ? "s" : ""} missed
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">No missed days</span>
                    )}
                    <div className="flex items-center gap-1 text-gray-300">
                      <span className="text-xs">
                        {p.lastSyncAt ? formatDistanceToNow(new Date(p.lastSyncAt), { addSuffix: true }) : "Never synced"}
                      </span>
                      <ChevronRight size={13} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Remove confirmation modal */}
      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Remove property?</p>
                <p className="text-sm text-gray-500 mt-0.5 truncate">{removeTarget.name}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              This will remove the property and all its posts, analytics, and sync history from Softmarche. The Facebook Page and Instagram account itself are not affected.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRemoveTarget(null)}
                disabled={removing}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRemove}
                disabled={removing}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {removing ? "Removing…" : "Yes, remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
