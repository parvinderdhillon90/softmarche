"use client";

import { useState, useEffect } from "react";
import { Account } from "@/types";
import { PlatformBadge } from "@/components/ui/Badge";
import { format } from "date-fns";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/accounts").then((r) => r.json()).then(setAccounts);
  }, []);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setConnecting(true);
    setError("");
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortToken: token }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to connect");
      }
      const created: Account[] = await res.json();
      setAccounts((prev) => {
        const ids = new Set(created.map((a) => a.id));
        return [...prev.filter((a) => !ids.has(a.id)), ...created];
      });
      setToken("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Connected Accounts</h1>

      {/* Connect form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-base font-semibold mb-1">Connect a Meta Page</h2>
        <p className="text-sm text-gray-500 mb-4">
          Generate a short-lived User Access Token in{" "}
          <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
            Graph API Explorer
          </a>{" "}
          with <code className="bg-gray-100 px-1 rounded text-xs">pages_manage_posts</code>,{" "}
          <code className="bg-gray-100 px-1 rounded text-xs">pages_read_engagement</code>, and{" "}
          <code className="bg-gray-100 px-1 rounded text-xs">instagram_basic</code> permissions, then paste it below.
        </p>
        <form onSubmit={handleConnect} className="flex gap-3">
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="EAAxxxxx…"
            required
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={connecting}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {connecting ? "Connecting…" : "Connect"}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {/* Account list */}
      <div className="space-y-3">
        {accounts.map((account) => (
          <div key={account.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-4">
            <PlatformBadge platform={account.platform} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{account.pageName}</p>
              <p className="text-xs text-gray-500">
                Page ID: {account.pageId}
                {account.instagramId && ` · IG: ${account.instagramId}`}
              </p>
            </div>
            <div className="text-right text-xs text-gray-400">
              {account.tokenExpiresAt
                ? `Token expires ${format(new Date(account.tokenExpiresAt), "MMM d, yyyy")}`
                : "No expiry"}
            </div>
          </div>
        ))}
        {accounts.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">No accounts connected yet.</p>
        )}
      </div>
    </div>
  );
}
