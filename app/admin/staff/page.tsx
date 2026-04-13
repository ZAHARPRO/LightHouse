"use client";

import { useEffect, useState, useTransition } from "react";
import { getStaffMembers } from "@/actions/admin";
import { RefreshCw } from "lucide-react";
import ActivityPing from "@/components/ActivityPing";

type StaffMember = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  lastActiveAt: Date | null;
  activity: string | null;
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "#ef4444",
  OPERATOR: "#f97316",
  STAFF: "#fbbf24",
};

const ONLINE_MS = 5 * 60 * 1000; // 5 minutes

function isOnline(lastActiveAt: Date | null) {
  if (!lastActiveAt) return false;
  return Date.now() - new Date(lastActiveAt).getTime() < ONLINE_MS;
}

function timeAgo(date: Date | null) {
  if (!date) return "Never";
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function AdminStaffPage() {
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [pending, start] = useTransition();
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  function load() {
    start(async () => {
      const data = await getStaffMembers();
      setMembers(data as StaffMember[]);
      setLastRefresh(new Date());
    });
  }

  // initial load + auto-refresh every 30s
  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const online  = members.filter((m) => isOnline(m.lastActiveAt));
  const offline = members.filter((m) => !isOnline(m.lastActiveAt));

  return (
    <>
      <ActivityPing activity="Admin — Staff Overview" />

      <div>
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-display font-extrabold text-2xl tracking-tight text-[var(--text-primary)]">Staff</h1>
          <button
            onClick={load}
            disabled={pending}
            className="flex items-center gap-1.5 text-[0.8rem] font-display font-semibold text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors bg-transparent border-none cursor-pointer disabled:opacity-40"
          >
            <RefreshCw size={13} className={pending ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
        <p className="text-[var(--text-muted)] text-sm mb-6">
          {online.length} online · {offline.length} offline · refreshes every 30s
          <span className="ml-2 opacity-60">· last {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </p>

        {/* Online */}
        {online.length > 0 && (
          <div className="mb-6">
            <p className="text-[0.7rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-[0.08em] mb-3">
              Online — {online.length}
            </p>
            <div className="flex flex-col gap-2">
              {online.map((m) => <MemberCard key={m.id} member={m} online />)}
            </div>
          </div>
        )}

        {/* Offline */}
        {offline.length > 0 && (
          <div>
            <p className="text-[0.7rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-[0.08em] mb-3">
              Offline — {offline.length}
            </p>
            <div className="flex flex-col gap-2">
              {offline.map((m) => <MemberCard key={m.id} member={m} online={false} />)}
            </div>
          </div>
        )}

        {members.length === 0 && !pending && (
          <p className="text-center text-[var(--text-muted)] text-sm py-16">No staff members found</p>
        )}
      </div>
    </>
  );
}

function MemberCard({ member, online }: { member: StaffMember; online: boolean }) {
  const roleColor = ROLE_COLORS[member.role] ?? "#888";
  const initial   = (member.name ?? member.email ?? "?")[0].toUpperCase();

  return (
    <div
      className="flex items-center gap-4 px-5 py-4 rounded-xl border transition-colors"
      style={{
        background: online ? "var(--bg-card)" : "var(--bg-elevated)",
        borderColor: online ? `${roleColor}25` : "var(--border-subtle)",
      }}
    >
      {/* Avatar + online dot */}
      <div className="relative shrink-0">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-sm"
          style={{ background: `${roleColor}18`, color: roleColor, border: `2px solid ${roleColor}30` }}
        >
          {initial}
        </div>
        <span
          className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[var(--bg-primary)]"
          style={{ background: online ? "#22c55e" : "#555" }}
        />
      </div>

      {/* Name + email */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-display font-semibold text-sm text-[var(--text-primary)]">{member.name ?? "—"}</p>
          <span
            className="text-[0.65rem] font-display font-bold px-1.5 py-[0.1rem] rounded-full"
            style={{ background: `${roleColor}15`, color: roleColor, border: `1px solid ${roleColor}30` }}
          >
            {member.role}
          </span>
        </div>
        <p className="text-[0.75rem] text-[var(--text-muted)] truncate">{member.email}</p>
      </div>

      {/* Activity + last seen */}
      <div className="text-right shrink-0 max-w-[220px]">
        {online && member.activity ? (
          <p className="text-[0.78rem] font-display font-semibold text-[var(--text-secondary)] truncate">
            {member.activity}
          </p>
        ) : online ? (
          <p className="text-[0.78rem] text-[var(--text-muted)]">Active</p>
        ) : (
          <p className="text-[0.78rem] text-[var(--text-muted)]">
            Last seen {timeAgo(member.lastActiveAt)}
          </p>
        )}
        {online && (
          <p className="text-[0.7rem] text-[var(--text-muted)] mt-0.5">
            {timeAgo(member.lastActiveAt)}
          </p>
        )}
      </div>
    </div>
  );
}
