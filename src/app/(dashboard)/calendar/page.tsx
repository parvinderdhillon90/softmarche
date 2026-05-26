"use client";

import { useState, useEffect, useCallback } from "react";
import { format, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { PostForm, PostPayload } from "@/components/posts/PostForm";
import { Account, Post } from "@/types";

export default function CalendarPage() {
  const [month, setMonth] = useState(new Date());
  const [posts, setPosts] = useState<Post[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [prefillDate, setPrefillDate] = useState<string | null>(null);

  const monthKey = format(month, "yyyy-MM");

  const loadData = useCallback(async () => {
    const [postsRes, accountsRes] = await Promise.all([
      fetch(`/api/posts?month=${monthKey}`),
      fetch("/api/accounts"),
    ]);
    setPosts(await postsRes.json());
    setAccounts(await accountsRes.json());
  }, [monthKey]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSave(data: PostPayload) {
    if (selectedPost) {
      await fetch(`/api/posts/${selectedPost.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } else {
      await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    }
    setShowForm(false);
    setSelectedPost(null);
    loadData();
  }

  async function handlePublishNow(postId: string) {
    await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    });
    loadData();
  }

  async function handleDelete(postId: string) {
    await fetch(`/api/posts/${postId}`, { method: "DELETE" });
    setSelectedPost(null);
    loadData();
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Content Calendar</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setMonth(subMonths(month, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <ChevronLeft size={18} />
            </button>
            <span className="text-base font-medium w-36 text-center">{format(month, "MMMM yyyy")}</span>
            <button onClick={() => setMonth(addMonths(month, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <button
          onClick={() => { setSelectedPost(null); setPrefillDate(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <Plus size={16} /> New Post
        </button>
      </div>

      <CalendarGrid
        month={month}
        posts={posts}
        onDayClick={(date) => {
          setPrefillDate(format(date, "yyyy-MM-dd'T'09:00"));
          setSelectedPost(null);
          setShowForm(true);
        }}
        onPostClick={(post) => setSelectedPost(post)}
      />

      {/* Post composer modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold">{selectedPost ? "Edit Post" : "New Post"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-full">
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <PostForm
                accounts={accounts}
                initial={selectedPost ?? (prefillDate ? { scheduledAt: prefillDate } : undefined)}
                onSave={handleSave}
                onCancel={() => setShowForm(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Post detail panel */}
      {selectedPost && !showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold">Post Details</h2>
              <button onClick={() => setSelectedPost(null)} className="p-1 hover:bg-gray-100 rounded-full">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-700">{selectedPost.caption}</p>
              <p className="text-xs text-gray-500">
                {selectedPost.scheduledAt
                  ? `Scheduled: ${format(new Date(selectedPost.scheduledAt), "PPp")}`
                  : "No schedule set"}
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setShowForm(true); }}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Edit
                </button>
                {selectedPost.status !== "PUBLISHED" && (
                  <button
                    onClick={() => handlePublishNow(selectedPost.id)}
                    className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Publish Now
                  </button>
                )}
                <button
                  onClick={() => handleDelete(selectedPost.id)}
                  className="px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
