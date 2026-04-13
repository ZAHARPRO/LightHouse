"use client";

import { useState, useTransition, useEffect } from "react";
import { Search, Shield, Trash2, ChevronDown } from "lucide-react";
import { getAdminUsers, changeUserRole, changeUserTier, deleteUser } from "@/actions/admin";
import ActivityPing from "@/components/ActivityPing";

type User = {
  id: string; name: string | null; email: string | null;
  tier: string; role: string; points: number; createdAt: Date;
  _count: { videos: number; rewards: number };
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "#ef4444", OPERATOR: "#f97316", STAFF: "#fbbf24", USER: "#888",
};
const TIER_COLORS: Record<string, string> = {
  ELITE: "#fbbf24", PRO: "#f97316", BASIC: "#818cf8", FREE: "#888",
};

function SelectPill({
  value, options, onChange, colors,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  colors: Record<string, string>;
}) {
  const color = colors[value] ?? "#888";
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-2.5 pr-6 py-[0.2rem] rounded-full text-[0.7rem] font-display font-bold border cursor-pointer bg-transparent transition-colors duration-150"
        style={{ color, borderColor: `${color}40`, background: `${color}12` }}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={10} className="absolute right-1.5 pointer-events-none" style={{ color }} />
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers]   = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [pending, start]    = useTransition();
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    start(async () => {
      const data = await getAdminUsers(search);
      setUsers(data as User[]);
    });
  }, [search]);

  function handleRole(userId: string, role: string) {
    start(async () => {
      await changeUserRole(userId, role);
      setUsers((p) => p.map((u) => u.id === userId ? { ...u, role } : u));
    });
  }

  function handleTier(userId: string, tier: string) {
    start(async () => {
      await changeUserTier(userId, tier);
      setUsers((p) => p.map((u) => u.id === userId ? { ...u, tier } : u));
    });
  }

  async function handleDelete(userId: string, name: string | null) {
    if (!confirm(`Delete user "${name ?? userId}"? This cannot be undone.`)) return;
    setDeleting(userId);
    await deleteUser(userId);
    setUsers((p) => p.filter((u) => u.id !== userId));
    setDeleting(null);
  }

  return (
    <div>
      <ActivityPing activity="Admin — User Management" />
      <h1 className="font-display font-extrabold text-2xl tracking-tight text-[var(--text-primary)] mb-1">Users</h1>
      <p className="text-[var(--text-muted)] text-sm mb-6">{users.length} users total</p>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="input-field pl-9 w-full"
        />
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                {["User", "Role", "Tier", "Points", "Videos", "Badges", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[0.75rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-[0.05em]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-elevated)] transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-display font-semibold text-[var(--text-primary)] text-[0.875rem]">{u.name ?? "—"}</p>
                    <p className="text-[0.75rem] text-[var(--text-muted)]">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <SelectPill
                      value={u.role}
                      options={["USER","STAFF","OPERATOR","ADMIN"]}
                      onChange={(v) => handleRole(u.id, v)}
                      colors={ROLE_COLORS}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <SelectPill
                      value={u.tier}
                      options={["FREE","BASIC","PRO","ELITE"]}
                      onChange={(v) => handleTier(u.id, v)}
                      colors={TIER_COLORS}
                    />
                  </td>
                  <td className="px-4 py-3 font-display font-bold text-[var(--text-primary)]">{u.points}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{u._count.videos}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{u._count.rewards}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(u.id, u.name)}
                      disabled={deleting === u.id || pending}
                      className="p-1.5 rounded-lg border-none bg-transparent text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && !pending && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[var(--text-muted)] text-sm">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pending && (
        <p className="text-center text-[var(--text-muted)] text-sm mt-4 flex items-center justify-center gap-2">
          <Shield size={14} className="animate-pulse" /> Loading…
        </p>
      )}
    </div>
  );
}
