"use client";

import { useState, useEffect } from "react";
import { Users, Plus, Trash2, Building2, Search, X, CheckSquare, Square } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  createdAt: string;
  accountIds: string[];
}

interface Property {
  id: string;
  pageName: string;
  username: string | null;
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  // Add member modal
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  // Assign properties modal
  const [assignTarget, setAssignTarget] = useState<TeamMember | null>(null);
  const [assignSelected, setAssignSelected] = useState<Set<string>>(new Set());
  const [assignSearch, setAssignSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Remove confirm
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/team").then(r => r.json()),
      fetch("/api/properties").then(r => r.json()),
    ]).then(([ms, ps]) => {
      setMembers(ms);
      setProperties(ps);
      setLoading(false);
    });
  }, []);

  async function handleAdd() {
    if (!addName.trim() || !addEmail.trim()) { setAddError("Name and email are required."); return; }
    setAdding(true); setAddError("");
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: addName.trim(), email: addEmail.trim(), role: addRole }),
    });
    if (!res.ok) {
      const d = await res.json();
      setAddError(d.error ?? "Failed to add member.");
      setAdding(false); return;
    }
    const member = await res.json();
    setMembers(prev => [...prev, member]);
    setShowAdd(false); setAddName(""); setAddEmail(""); setAddRole("MEMBER");
    setAdding(false);
  }

  function openAssign(member: TeamMember) {
    setAssignTarget(member);
    setAssignSelected(new Set(member.accountIds));
    setAssignSearch("");
  }

  async function handleSaveAssign() {
    if (!assignTarget) return;
    setSaving(true);
    await fetch(`/api/team/${assignTarget.id}/accounts`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountIds: Array.from(assignSelected) }),
    });
    setMembers(prev => prev.map(m =>
      m.id === assignTarget.id ? { ...m, accountIds: Array.from(assignSelected) } : m
    ));
    setAssignTarget(null);
    setSaving(false);
  }

  async function handleRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    await fetch(`/api/team/${removeTarget.id}`, { method: "DELETE" });
    setMembers(prev => prev.filter(m => m.id !== removeTarget.id));
    setRemoveTarget(null);
    setRemoving(false);
  }

  const filteredProps = properties.filter(p =>
    p.pageName.toLowerCase().includes(assignSearch.toLowerCase()) ||
    (p.username ?? "").toLowerCase().includes(assignSearch.toLowerCase())
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-sm text-gray-500 mt-0.5">{members.length} team member{members.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <Plus size={15} /> Add Member
        </button>
      </div>

      {/* Member cards */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
      ) : members.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No team members yet</p>
          <p className="text-sm mt-1">Add your first team member to start assigning properties.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map(m => (
            <div key={m.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              {/* Avatar + name */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-blue-600">{m.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm leading-tight">{m.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{m.email}</p>
                  </div>
                </div>
                <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  m.role === "ADMIN" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"
                }`}>
                  {m.role === "ADMIN" ? "Admin" : "Member"}
                </span>
              </div>

              {/* Property count */}
              <div className="flex items-center gap-2 py-3 border-t border-b border-gray-100 mb-4">
                <Building2 size={14} className="text-gray-400" />
                <span className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-900">{m.accountIds.length}</span> propert{m.accountIds.length !== 1 ? "ies" : "y"} assigned
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => openAssign(m)}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"
                >
                  Manage Properties
                </button>
                <button
                  onClick={() => setRemoveTarget(m)}
                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Remove member"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ADD MEMBER MODAL ── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-900">Add Team Member</h2>
              <button onClick={() => { setShowAdd(false); setAddError(""); }} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Full Name</label>
                <input
                  type="text"
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  placeholder="e.g. Riya Sharma"
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</label>
                <input
                  type="email"
                  value={addEmail}
                  onChange={e => setAddEmail(e.target.value)}
                  placeholder="riya@agency.com"
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</label>
                <select
                  value={addRole}
                  onChange={e => setAddRole(e.target.value as "ADMIN" | "MEMBER")}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              {addError && <p className="text-xs text-red-600">{addError}</p>}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setShowAdd(false); setAddError(""); }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={adding}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {adding ? "Adding…" : "Add Member"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ASSIGN PROPERTIES MODAL ── */}
      {assignTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[85vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-900">Assign Properties</h2>
                <p className="text-sm text-gray-500 mt-0.5">{assignTarget.name} · {assignSelected.size} selected</p>
              </div>
              <button onClick={() => setAssignTarget(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <Search size={14} className="text-gray-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search properties…"
                  value={assignSearch}
                  onChange={e => setAssignSearch(e.target.value)}
                  className="text-sm outline-none bg-transparent w-full"
                />
              </div>
              {/* Select / deselect all */}
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => setAssignSelected(new Set(filteredProps.map(p => p.id)))}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Select all shown
                </button>
                <span className="text-gray-300 text-xs">·</span>
                <button
                  onClick={() => {
                    const toRemove = new Set(filteredProps.map(p => p.id));
                    setAssignSelected(prev => new Set([...prev].filter(id => !toRemove.has(id))));
                  }}
                  className="text-xs text-gray-500 hover:underline"
                >
                  Deselect all shown
                </button>
              </div>
            </div>

            {/* Property list */}
            <div className="overflow-y-auto flex-1 p-2">
              {filteredProps.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No properties found</p>
              ) : (
                filteredProps.map(p => {
                  const checked = assignSelected.has(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setAssignSelected(prev => {
                          const next = new Set(prev);
                          checked ? next.delete(p.id) : next.add(p.id);
                          return next;
                        });
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-left"
                    >
                      {checked
                        ? <CheckSquare size={16} className="text-blue-600 shrink-0" />
                        : <Square size={16} className="text-gray-300 shrink-0" />
                      }
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.pageName}</p>
                        {p.username && <p className="text-xs text-gray-400">@{p.username}</p>}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-5 border-t border-gray-100 shrink-0">
              <button
                onClick={() => setAssignTarget(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAssign}
                disabled={saving}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : `Save (${assignSelected.size} properties)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REMOVE CONFIRM MODAL ── */}
      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Remove team member?</p>
                <p className="text-sm text-gray-500 mt-0.5">{removeTarget.name}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              This will remove {removeTarget.name} from the team and unassign all their properties. The properties themselves are not affected.
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
