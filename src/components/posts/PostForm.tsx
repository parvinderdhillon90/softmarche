"use client";

import { useState } from "react";
import { Account, MediaType, Platform, Post } from "@/types";

interface Props {
  accounts: Account[];
  initial?: Partial<Post>;
  onSave: (data: PostPayload) => Promise<void>;
  onCancel: () => void;
}

export interface PostPayload {
  accountId: string;
  platform: Platform;
  caption: string;
  mediaUrls: string[];
  mediaType: MediaType;
  scheduledAt: string | null;
}

export function PostForm({ accounts, initial, onSave, onCancel }: Props) {
  const [accountId, setAccountId] = useState(initial?.accountId ?? "");
  const [caption, setCaption] = useState(initial?.caption ?? "");
  const [mediaUrlsRaw, setMediaUrlsRaw] = useState(initial?.mediaUrls?.join("\n") ?? "");
  const [mediaType, setMediaType] = useState<MediaType>(initial?.mediaType ?? "IMAGE");
  const [scheduledAt, setScheduledAt] = useState(initial?.scheduledAt?.slice(0, 16) ?? "");
  const [saving, setSaving] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === accountId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAccount) return;
    setSaving(true);
    try {
      await onSave({
        accountId,
        platform: selectedAccount.platform,
        caption,
        mediaUrls: mediaUrlsRaw.split("\n").map((u) => u.trim()).filter(Boolean),
        mediaType,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          required
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select account…</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.pageName} ({a.platform})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Caption</label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          required
          rows={4}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Write your post…"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Media URLs <span className="text-gray-400 font-normal">(one per line)</span>
        </label>
        <textarea
          value={mediaUrlsRaw}
          onChange={(e) => setMediaUrlsRaw(e.target.value)}
          rows={3}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="https://…"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Media type</label>
          <select
            value={mediaType}
            onChange={(e) => setMediaType(e.target.value as MediaType)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="IMAGE">Image</option>
            <option value="VIDEO">Video</option>
            <option value="CAROUSEL">Carousel</option>
            <option value="REEL">Reel</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Schedule for</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : scheduledAt ? "Schedule" : "Save Draft"}
        </button>
      </div>
    </form>
  );
}
