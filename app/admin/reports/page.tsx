"use client";

import { useEffect, useState, useTransition } from "react";
import { getReportedUsers, banUser, unbanUser, dismissReports, muteUser, unmuteUser } from "@/actions/admin";
import { getUserTickets, staffReply, closeConversation } from "@/actions/support";
import { Flag, Ban, ShieldOff, Trash2, RefreshCw, ChevronDown, ChevronUp, ShieldAlert, MessageCircle, Send, CheckCircle, Inbox, VolumeX, Volume2 } from "lucide-react";
import ActivityPing from "@/components/ActivityPing";

type ReportItem = {
  id: string;
  reason: string;
  game: string | null;
  roomId: string | null;
  createdAt: Date;
  reporter: { id: string; name: string | null };
};

type ReportedUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  isBanned: boolean;
  banReason: string | null;
  bannedAt: Date | null;
  muteExpiresAt: Date | null;
  reportCount: number;
  reports: ReportItem[];
};

type TicketMsg = {
  id: string;
  content: string;
  isFromStaff: boolean;
  createdAt: Date;
  sender: { id: string; name: string | null };
};

type Ticket = {
  id: string;
  status: string;
  isAppeal: boolean;
  createdAt: Date;
  updatedAt: Date;
  messages: TicketMsg[];
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "#ef4444", OPERATOR: "#f97316", STAFF: "#fbbf24", USER: "#888",
};

function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const MUTE_DURATIONS = [
  { label: "1 hour",  value: 60 },
  { label: "6 hours", value: 360 },
  { label: "1 day",   value: 1440 },
  { label: "7 days",  value: 10080 },
  { label: "30 days", value: 43200 },
  { label: "Forever", value: null },
];

export default function AdminReportsPage() {
  const [users, setUsers]         = useState<ReportedUser[]>([]);
  const [pending, start]          = useTransition();
  const [banReasons, setBanReasons] = useState<Record<string, string>>({});
  const [muteDurations, setMuteDurations] = useState<Record<string, number | null>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tickets, setTickets]     = useState<Record<string, Ticket[]>>({});
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});

  function load() {
    start(async () => {
      const data = await getReportedUsers();
      setUsers(data as ReportedUser[]);
    });
  }

  useEffect(() => { load(); }, []);

  function toggleExpand(userId: string) {
    if (expandedId === userId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(userId);
    if (!tickets[userId]) {
      start(async () => {
        const data = await getUserTickets(userId);
        setTickets((p) => ({ ...p, [userId]: data as Ticket[] }));
      });
    }
  }

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

  function handleMute(userId: string, name: string | null, reason: string) {
    const duration = muteDurations[userId] !== undefined ? muteDurations[userId] : 1440;
    const label = MUTE_DURATIONS.find(d => d.value === duration)?.label ?? "custom";
    if (!confirm(`Mute "${name ?? userId}" for ${label}?`)) return;
    start(async () => {
      await muteUser(userId, reason, duration);
      setUsers(p => p.map(u => u.id === userId
        ? { ...u, muteExpiresAt: duration ? new Date(Date.now() + duration * 60000) : null }
        : u));
    });
  }

  function handleUnmute(userId: string) {
    start(async () => {
      await unmuteUser(userId);
      setUsers(p => p.map(u => u.id === userId ? { ...u, muteExpiresAt: null } : u));
    });
  }

  function handleDismiss(userId: string) {
    if (!confirm("Dismiss all reports for this user?")) return;
    start(async () => {
      await dismissReports(userId);
      setUsers((p) => p.filter((u) => u.id !== userId));
      setExpandedId(null);
    });
  }

  function handleReply(ticketId: string, userId: string) {
    const content = replyInputs[ticketId]?.trim();
    if (!content) return;
    setReplyInputs((p) => ({ ...p, [ticketId]: "" }));
    const optimistic: TicketMsg = {
      id: `opt-${Date.now()}`,
      content,
      isFromStaff: true,
      createdAt: new Date(),
      sender: { id: "me", name: "You" },
    };
    setTickets((p) => ({
      ...p,
      [userId]: (p[userId] ?? []).map((t) =>
        t.id === ticketId ? { ...t, messages: [...t.messages, optimistic] } : t
      ),
    }));
    start(async () => {
      const res = await staffReply(ticketId, content);
      if (res.message) {
        setTickets((p) => ({
          ...p,
          [userId]: (p[userId] ?? []).map((t) =>
            t.id === ticketId
              ? { ...t, messages: t.messages.map((m) => m.id === optimistic.id ? (res.message as TicketMsg) : m) }
              : t
          ),
        }));
      }
    });
  }

  function handleCloseTicket(ticketId: string, userId: string) {
    start(async () => {
      await closeConversation(ticketId);
      setTickets((p) => ({
        ...p,
        [userId]: (p[userId] ?? []).map((t) =>
          t.id === ticketId ? { ...t, status: "CLOSED" } : t
        ),
      }));
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
              const isExpanded = expandedId === u.id;
              const userTickets = tickets[u.id] ?? [];

              return (
                <div
                  key={u.id}
                  className="bg-[var(--bg-card)] border rounded-xl overflow-hidden"
                  style={{ borderColor: u.isBanned ? "rgba(239,68,68,0.2)" : "var(--border-subtle)" }}
                >
                  {/* Card header — clickable to expand */}
                  <button
                    onClick={() => toggleExpand(u.id)}
                    className="w-full text-left p-5 bg-transparent border-none cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors"
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
                      <div className="flex-1 min-w-0 text-left">
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
                          <p className="text-[0.75rem] text-red-400 mt-0.5">Ban reason: {u.banReason}</p>
                        )}
                      </div>

                      {/* Right side: report count + chevron */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
                        >
                          <Flag size={12} className="text-red-400" />
                          <span className="font-display font-bold text-sm text-red-400">{u.reportCount}</span>
                        </div>
                        {isExpanded ? <ChevronUp size={15} className="text-[var(--text-muted)]" /> : <ChevronDown size={15} className="text-[var(--text-muted)]" />}
                      </div>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-[var(--border-subtle)]">

                      {/* Report list */}
                      {u.reports.length > 0 && (
                        <div className="px-5 pt-4 pb-2">
                          <p className="text-[0.7rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-wide mb-2">Reports</p>
                          <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                            {u.reports.map(r => (
                              <div key={r.id} className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs">
                                <div className="flex-1 min-w-0">
                                  <span className="text-[var(--text-primary)]">{r.reason}</span>
                                  {r.game && (
                                    <span className="ml-1.5 px-1 py-[0.1rem] rounded text-[0.6rem] font-bold bg-orange-500/10 text-[var(--accent-orange)] border border-orange-500/20 uppercase">
                                      {r.game}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[var(--text-muted)] shrink-0">{r.reporter.name ?? "?"} · {timeAgo(r.createdAt)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="px-5 py-4 flex flex-col gap-3 bg-[var(--bg-secondary)]">
                        {/* Ban / unban */}
                        <div className="flex items-center gap-3 flex-wrap">
                          {!u.isBanned && (
                            <>
                              <input
                                value={banReasons[u.id] ?? ""}
                                onChange={(e) => setBanReasons((p) => ({ ...p, [u.id]: e.target.value }))}
                                placeholder="Ban reason (optional)"
                                className="input-field flex-1 min-w-[150px] text-sm py-1.5"
                              />
                              <button
                                onClick={() => handleBan(u.id, u.name)}
                                disabled={pending}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-display font-semibold text-red-400 bg-red-500/8 hover:bg-red-500/15 border border-red-500/20 transition-colors cursor-pointer disabled:opacity-40 bg-transparent"
                              >
                                <Ban size={13} /> Ban
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
                            <Trash2 size={13} /> Dismiss
                          </button>
                        </div>

                        {/* Mute / unmute */}
                        <div className="flex items-center gap-3 flex-wrap">
                          {!u.muteExpiresAt || new Date(u.muteExpiresAt) < new Date() ? (
                            <>
                              <select
                                value={muteDurations[u.id] !== undefined ? String(muteDurations[u.id]) : "1440"}
                                onChange={e => setMuteDurations(p => ({ ...p, [u.id]: e.target.value === "null" ? null : Number(e.target.value) }))}
                                className="input-field text-sm py-1.5"
                              >
                                {MUTE_DURATIONS.map(d => (
                                  <option key={String(d.value)} value={String(d.value)}>{d.label}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleMute(u.id, u.name, banReasons[u.id] || (u.reports[0]?.reason ?? "Muted by admin"))}
                                disabled={pending}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-display font-semibold text-orange-400 bg-orange-500/8 hover:bg-orange-500/15 border border-orange-500/20 transition-colors cursor-pointer disabled:opacity-40 bg-transparent"
                              >
                                <VolumeX size={13} /> Mute
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="text-xs text-orange-400 font-display">
                                Muted until {new Date(u.muteExpiresAt).toLocaleString()}
                              </span>
                              <button
                                onClick={() => handleUnmute(u.id)}
                                disabled={pending}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-display font-semibold text-green-400 bg-green-500/8 hover:bg-green-500/15 border border-green-500/20 transition-colors cursor-pointer disabled:opacity-40 bg-transparent"
                              >
                                <Volume2 size={13} /> Unmute
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Tickets */}
                      <div className="px-5 py-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Inbox size={13} className="text-[var(--text-muted)]" />
                          <span className="font-display font-semibold text-[0.8125rem] text-[var(--text-muted)]">
                            Support tickets ({userTickets.length})
                          </span>
                        </div>

                        {pending && userTickets.length === 0 ? (
                          <p className="text-[0.8rem] text-[var(--text-muted)]">Loading…</p>
                        ) : userTickets.length === 0 ? (
                          <p className="text-[0.8rem] text-[var(--text-muted)]">No tickets from this user.</p>
                        ) : (
                          <div className="flex flex-col gap-3">
                            {userTickets.map((ticket) => (
                              <div
                                key={ticket.id}
                                className="rounded-xl border overflow-hidden"
                                style={{ borderColor: ticket.status === "CLOSED" ? "var(--border-subtle)" : "rgba(249,115,22,0.2)" }}
                              >
                                {/* Ticket header */}
                                <div
                                  className="flex items-center gap-2 px-3 py-2"
                                  style={{ background: ticket.status === "CLOSED" ? "var(--bg-elevated)" : "rgba(249,115,22,0.06)" }}
                                >
                                  {ticket.isAppeal ? (
                                    <span className="flex items-center gap-1 text-[0.65rem] font-display font-bold px-1.5 py-[0.15rem] rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                                      <ShieldAlert size={9} /> Appeal
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1 text-[0.65rem] font-display font-bold px-1.5 py-[0.15rem] rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                      <MessageCircle size={9} /> Support
                                    </span>
                                  )}
                                  {ticket.status === "CLOSED" ? (
                                    <span className="text-[0.65rem] font-display font-bold px-1.5 py-[0.15rem] rounded-full bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                                      CLOSED
                                    </span>
                                  ) : (
                                    <span className="text-[0.65rem] font-display font-bold px-1.5 py-[0.15rem] rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                                      OPEN
                                    </span>
                                  )}
                                  <span className="ml-auto text-[0.65rem] text-[var(--text-muted)]">{timeAgo(ticket.updatedAt)}</span>
                                </div>

                                {/* Messages */}
                                <div className="flex flex-col gap-2 p-3 max-h-[220px] overflow-y-auto bg-[var(--bg-card)]">
                                  {ticket.messages.length === 0 && (
                                    <p className="text-[0.75rem] text-[var(--text-muted)] text-center py-2">No messages</p>
                                  )}
                                  {ticket.messages.map((msg) => (
                                    <div
                                      key={msg.id}
                                      className={["flex flex-col", msg.isFromStaff ? "items-end" : "items-start"].join(" ")}
                                    >
                                      <span className="text-[0.6rem] text-[var(--text-muted)] mb-0.5 mx-1">
                                        {msg.isFromStaff ? (msg.sender.name ?? "Staff") : (u.name ?? "User")}
                                      </span>
                                      <div
                                        className="max-w-[85%] px-2.5 py-1.5 rounded-xl text-[0.8rem] leading-snug break-words"
                                        style={{
                                          background: msg.isFromStaff ? "rgba(249,115,22,0.12)" : "var(--bg-elevated)",
                                          border: msg.isFromStaff ? "1px solid rgba(249,115,22,0.2)" : "1px solid var(--border-subtle)",
                                          color: "var(--text-primary)",
                                          borderBottomRightRadius: msg.isFromStaff ? 4 : undefined,
                                          borderBottomLeftRadius: msg.isFromStaff ? undefined : 4,
                                        }}
                                      >
                                        {msg.content}
                                      </div>
                                      <span className="text-[0.6rem] text-[var(--text-muted)] mt-0.5 mx-1">{timeAgo(msg.createdAt)}</span>
                                    </div>
                                  ))}
                                </div>

                                {/* Reply area (only for open tickets) */}
                                {ticket.status === "OPEN" && (
                                  <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2.5 flex flex-col gap-2">
                                    <form
                                      onSubmit={(e) => { e.preventDefault(); handleReply(ticket.id, u.id); }}
                                      className="flex gap-2"
                                    >
                                      <input
                                        value={replyInputs[ticket.id] ?? ""}
                                        onChange={(e) => setReplyInputs((p) => ({ ...p, [ticket.id]: e.target.value }))}
                                        placeholder="Reply to user…"
                                        maxLength={1000}
                                        className="input-field flex-1 text-[0.8rem] h-8"
                                      />
                                      <button
                                        type="submit"
                                        disabled={!replyInputs[ticket.id]?.trim() || pending}
                                        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--accent-orange)] border-none text-white cursor-pointer disabled:opacity-50"
                                      >
                                        <Send size={13} />
                                      </button>
                                    </form>
                                    <button
                                      onClick={() => handleCloseTicket(ticket.id, u.id)}
                                      disabled={pending}
                                      className="flex items-center justify-center gap-1.5 w-full py-1 rounded-lg border border-[var(--border-subtle)] bg-transparent text-[var(--text-muted)] text-[0.75rem] font-display font-semibold cursor-pointer hover:text-[var(--accent-orange)] hover:border-orange-500/40 transition-colors"
                                    >
                                      <CheckCircle size={11} /> Close ticket
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
