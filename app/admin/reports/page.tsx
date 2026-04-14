"use client";

import { useEffect, useState, useTransition } from "react";
import { getReportedUsers, banUser, unbanUser, dismissReports } from "@/actions/admin";
import { Flag, Ban, ShieldOff, Trash2, RefreshCw } from "lucide-react";
import ActivityPing from "@/components/ActivityPing";

type ReportedUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  isBanned: boolean;
  banReason: string | null;
  bannedAt: Date | null;
  reportCount: number;
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "#ef4444", OPERATOR: "#f97316", STAFF: "#fbbf24", USER: "#888",
};

export default function AdminReportsPage() {
  const [users, setUsers]   = useState<ReportedUser[]>([]);
  const [pending, start]    = useTransition();
  const [banReasons, setBanReasons] = useState<Record<string, string>>({});

  function load() {
    start(async () => {
      const data = await getReportedUsers();
      setUsers(data as ReportedUser[]);
    });
  }

  useEffect(() => { load(); }, []);

  function handleBan(userId: string, name: string | null) {
    const reason = banReasons[userId]?.trim() || "Violated community guidelines";
    if (!confirm(`Ban "${name ?? userId}"? They will lose access to posting, chat, and comments.`)) return;
    start(async () => {
      await banUser(userId, reason);
      setUsers((p) => p.map((u) => u.id === userId ? { ...u, isBanned: true, banReason: reason } : u));
    });
  }

  function handleUnban(userId: string) {
    start(async () => {
      await unbanUser(userId);
      setUsers((p) => p.map((u) => u.id === userId ? { ...u, isBanned: false, banReason: null, bannedAt: null } : u));
    });
  }

  function handleDismiss(userId: string) {
    if (!confirm("Dismiss all reports for this user?")) return;
    start(async () => {
      await dismissReports(userId);
      setUsers((p) => p.filter((u) => u.id !== userId));
    });
  }

  return (
    <>
      <ActivityPing activity="Admin — Reports" />
      <div>
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-display font-extrabold text-2xl tracking-tight text-[var(--text-primary)]">Reports</h1>
          <button
            onClick={load}
            disabled={pending}
            className="flex items-center gap-1.5 text-[0.8rem] font-display font-semibold text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors bg-transparent border-none cursor-pointer disabled:opacity-40"
          >
            <RefreshCw size={13} className={pending ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
        <p className="text-[var(--text-muted)] text-sm mb-6">{users.length} user{users.length !== 1 ? "s" : ""} reported</p>

        {users.length === 0 && !pending ? (
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-12 text-center">
            <Flag size={28} className="mx-auto mb-3 text-[var(--text-muted)]" />
            <p className="text-[var(--text-muted)]">No reports yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {users.map((u) => {
              const roleColor = ROLE_COLORS[u.role] ?? "#888";
              return (
                <div
                  key={u.id}
                  className="bg-[var(--bg-card)] border rounded-xl p-5"
                  style={{ borderColor: u.isBanned ? "rgba(239,68,68,0.2)" : "var(--border-subtle)" }}
                >
                  <div className="flex items-start gap-4 flex-wrap">
                    {/* Avatar */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-sm shrink-0"
                      style={{ background: `${roleColor}18`, color: roleColor, border: `2px solid ${roleColor}30` }}
                    >
                      {(u.name ?? u.email ?? "?")[0].toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="font-display font-semibold text-sm text-[var(--text-primary)]">{u.name ?? "—"}</p>
                        <span
                          className="text-[0.65rem] font-display font-bold px-1.5 py-[0.1rem] rounded-full"
                          style={{ background: `${roleColor}15`, color: roleColor, border: `1px solid ${roleColor}30` }}
                        >
                          {u.role}
                        </span>
                        {u.isBanned && (
                          <span className="text-[0.65rem] font-display font-bold px-1.5 py-[0.1rem] rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                            BANNED
                          </span>
                        )}
                      </div>
                      <p className="text-[0.75rem] text-[var(--text-muted)]">{u.email}</p>
                      {u.isBanned && u.banReason && (
                        <p className="text-[0.75rem] text-red-400 mt-1">Ban reason: {u.banReason}</p>
                      )}
                    </div>

                    {/* Report count */}
                    <div
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg shrink-0"
                      style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
                    >
                      <Flag size={12} className="text-red-400" />
                      <span className="font-display font-bold text-sm text-red-400">{u.reportCount} report{u.reportCount !== 1 ? "s" : ""}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex items-center gap-3 flex-wrap">
                    {!u.isBanned && (
                      <>
                        <input
                          value={banReasons[u.id] ?? ""}
                          onChange={(e) => setBanReasons((p) => ({ ...p, [u.id]: e.target.value }))}
                          placeholder="Ban reason (optional)"
                          className="input-field flex-1 min-w-[200px] text-sm py-1.5"
                        />
                        <button
                          onClick={() => handleBan(u.id, u.name)}
                          disabled={pending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-display font-semibold text-red-400 bg-red-500/8 hover:bg-red-500/15 border border-red-500/20 transition-colors cursor-pointer disabled:opacity-40 bg-transparent"
                        >
                          <Ban size={13} /> Ban User
                        </button>
                      </>
                    )}
                    {u.isBanned && (
                      <button
                        onClick={() => handleUnban(u.id)}
                        disabled={pending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-display font-semibold text-green-400 bg-green-500/8 hover:bg-green-500/15 border border-green-500/20 transition-colors cursor-pointer disabled:opacity-40 bg-transparent"
                      >
                        <ShieldOff size={13} /> Unban
                      </button>
                    )}
                    <button
                      onClick={() => handleDismiss(u.id)}
                      disabled={pending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-display font-semibold text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-subtle)] transition-colors cursor-pointer disabled:opacity-40 bg-transparent"
                    >
                      <Trash2 size={13} /> Dismiss Reports
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
