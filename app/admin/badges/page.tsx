"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Plus, Trash2, Award, Search, Send, ChevronDown } from "lucide-react";
import {
  getCustomBadges,
  deleteCustomBadge,
  createCustomBadge,
  awardBadgeToUser,
  searchUsers,
} from "@/actions/admin";
import ActivityPing from "@/components/ActivityPing";

type CustomBadge = {
  id: string;
  icon: string;
  label: string;
  color: string;
  points: number;
  description: string;
  createdAt: Date;
  creator: { name: string | null };
  _count: { rewards: number };
};

type FoundUser = { id: string; name: string | null; email: string | null };

const BUILTIN_BADGES = [
  { type: "EARLY_ADOPTER",  icon: "🚀", label: "Early Adopter",  color: "#10b981", points: 200 },
  { type: "FIRST_COMMENT",  icon: "💬", label: "First Comment",  color: "#6366f1", points: 10  },
  { type: "WATCH_STREAK",   icon: "🔥", label: "Watch Streak",   color: "#f97316", points: 50  },
  { type: "SUPER_FAN",      icon: "⭐", label: "Super Fan",      color: "#fbbf24", points: 100 },
  { type: "PREMIUM_MEMBER", icon: "👑", label: "Premium Member", color: "#fbbf24", points: 150 },
];

const PRESET_COLORS = ["#6366f1", "#f97316", "#10b981", "#fbbf24", "#ec4899", "#3b82f6", "#8b5cf6", "#ef4444"];

export default function AdminBadgesPage() {
  const [badges, setBadges] = useState<CustomBadge[]>([]);
  const [pending, start] = useTransition();

  /* ── Create form ── */
  const [icon, setIcon]         = useState("🎖️");
  const [label, setLabel]       = useState("");
  const [color, setColor]       = useState("#6366f1");
  const [points, setPoints]     = useState(25);
  const [desc, setDesc]         = useState("");
  const [creating, setCreating] = useState(false);

  /* ── Award form ── */
  const [query, setQuery]           = useState("");
  const [foundUsers, setFoundUsers] = useState<FoundUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<FoundUser | null>(null);
  const [badgeType, setBadgeType]   = useState<"builtin" | "custom">("builtin");
  const [builtinType, setBuiltinType] = useState(BUILTIN_BADGES[0].type);
  const [customBadgeId, setCustomBadgeId] = useState("");
  const [adminNote, setAdminNote]   = useState("");
  const [awarding, setAwarding]     = useState(false);
  const [awardMsg, setAwardMsg]     = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    start(async () => {
      const data = await getCustomBadges();
      setBadges(data as CustomBadge[]);
    });
  }, []);

  /* search users debounced */
  useEffect(() => {
    if (!query.trim()) { setFoundUsers([]); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      const res = await searchUsers(query);
      setFoundUsers(res as FoundUser[]);
    }, 300);
  }, [query]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await createCustomBadge({ icon, label, color, points, description: desc });
    if ("badge" in res) {
      const b = res.badge as { id: string; icon: string; label: string; color: string; points: number; description: string; createdAt: Date; creatorId: string };
      setBadges((p) => [{ ...b, creator: { name: null }, _count: { rewards: 0 } }, ...p]);
      setLabel(""); setDesc(""); setIcon("🎖️"); setPoints(25); setColor("#6366f1");
    }
    setCreating(false);
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this badge? Rewards already given will remain.")) return;
    start(async () => {
      await deleteCustomBadge(id);
      setBadges((p) => p.filter((b) => b.id !== id));
    });
  }

  async function handleAward(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    setAwarding(true);
    setAwardMsg("");
    const res = await awardBadgeToUser({
      userId: selectedUser.id,
      badgeType,
      builtinType: badgeType === "builtin" ? builtinType : undefined,
      customBadgeId: badgeType === "custom" ? customBadgeId : undefined,
      adminNote,
    });
    if ("ok" in res) {
      setAwardMsg(`Badge awarded to ${selectedUser.name ?? selectedUser.email}!`);
      setAdminNote("");
    } else {
      setAwardMsg("Error: " + (res as { error: string }).error);
    }
    setAwarding(false);
  }

  return (
    <div className="space-y-8">
      <ActivityPing activity="Admin — Badge Creator" />
      <div>
        <h1 className="font-display font-extrabold text-2xl tracking-tight text-[var(--text-primary)] mb-1">Badge Creator</h1>
        <p className="text-[var(--text-muted)] text-sm">{badges.length} custom badge{badges.length !== 1 ? "s" : ""} created</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ── Left col: create + list ── */}
        <div className="space-y-6">

          {/* Create form */}
          <form
            onSubmit={handleCreate}
            className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-6"
          >
            <h2 className="font-display font-bold text-[0.9375rem] text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Plus size={15} className="text-[var(--accent-orange)]" /> New Custom Badge
            </h2>

            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* Icon */}
              <div>
                <label className="block text-[0.75rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-[0.05em] mb-1.5">Icon (emoji)</label>
                <input
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  maxLength={2}
                  className="input-field w-full text-center text-xl"
                  required
                />
              </div>
              {/* Points */}
              <div>
                <label className="block text-[0.75rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-[0.05em] mb-1.5">Points</label>
                <input
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(Number(e.target.value))}
                  min={0}
                  max={10000}
                  className="input-field w-full"
                  required
                />
              </div>
            </div>

            {/* Label */}
            <div className="mb-3">
              <label className="block text-[0.75rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-[0.05em] mb-1.5">Label</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Top Contributor"
                className="input-field w-full"
                required
              />
            </div>

            {/* Description */}
            <div className="mb-3">
              <label className="block text-[0.75rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-[0.05em] mb-1.5">Description</label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="What this badge means…"
                rows={2}
                className="input-field w-full resize-none"
                required
              />
            </div>

            {/* Color */}
            <div className="mb-4">
              <label className="block text-[0.75rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-[0.05em] mb-1.5">Color</label>
              <div className="flex gap-2 flex-wrap items-center">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="w-6 h-6 rounded-full border-2 transition-transform duration-100 hover:scale-110"
                    style={{
                      background: c,
                      borderColor: color === c ? "white" : "transparent",
                      boxShadow: color === c ? `0 0 0 2px ${c}` : "none",
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-7 h-7 rounded cursor-pointer bg-transparent border-0 p-0"
                  title="Custom color"
                />
              </div>
            </div>

            {/* Preview */}
            <div
              className="flex items-center gap-3 rounded-xl px-4 py-3 mb-4 border"
              style={{ background: `${color}10`, borderColor: `${color}30` }}
            >
              <span className="text-[1.5rem]">{icon}</span>
              <div>
                <p className="font-display font-bold text-sm" style={{ color }}>{label || "Badge Label"}</p>
                <p className="text-[0.75rem] text-[var(--text-muted)]">+{points} pts</p>
              </div>
            </div>

            <button
              type="submit"
              disabled={creating || pending}
              className="btn-primary w-full disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create Badge"}
            </button>
          </form>

          {/* Badge list */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
              <h2 className="font-display font-bold text-[0.9375rem] text-[var(--text-primary)]">Custom Badges</h2>
            </div>
            {badges.length === 0 && !pending ? (
              <p className="text-center text-[var(--text-muted)] text-sm py-8">No custom badges yet</p>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {badges.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[var(--bg-elevated)] transition-colors">
                    <span className="text-[1.25rem]">{b.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-sm" style={{ color: b.color }}>{b.label}</p>
                      <p className="text-[0.75rem] text-[var(--text-muted)] truncate">{b.description}</p>
                    </div>
                    <span className="text-[0.7rem] font-bold font-display shrink-0" style={{ color: b.color }}>+{b.points} pts</span>
                    <span className="text-[0.7rem] text-[var(--text-muted)] shrink-0">{b._count.rewards} awarded</span>
                    <button
                      onClick={() => handleDelete(b.id)}
                      disabled={pending}
                      className="p-1.5 rounded-lg bg-transparent border-none text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-40 shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right col: award ── */}
        <div>
          <form
            onSubmit={handleAward}
            className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-6"
          >
            <h2 className="font-display font-bold text-[0.9375rem] text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Award size={15} className="text-[var(--accent-orange)]" /> Award Badge to User
            </h2>

            {/* User search */}
            <div className="mb-4">
              <label className="block text-[0.75rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-[0.05em] mb-1.5">Search User</label>
              {selectedUser ? (
                <div
                  className="flex items-center justify-between px-3 py-2 rounded-lg border"
                  style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}
                >
                  <div>
                    <p className="font-display font-semibold text-sm text-[var(--text-primary)]">{selectedUser.name ?? "—"}</p>
                    <p className="text-[0.7rem] text-[var(--text-muted)]">{selectedUser.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedUser(null); setQuery(""); setFoundUsers([]); }}
                    className="text-[0.75rem] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors bg-transparent border-none cursor-pointer"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name or email…"
                    className="input-field pl-8 w-full"
                  />
                  {foundUsers.length > 0 && (
                    <div
                      className="absolute z-10 top-full left-0 right-0 mt-1 rounded-xl border overflow-hidden shadow-lg"
                      style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
                    >
                      {foundUsers.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => { setSelectedUser(u); setQuery(""); setFoundUsers([]); }}
                          className="w-full text-left px-4 py-3 hover:bg-[var(--bg-elevated)] transition-colors bg-transparent border-none cursor-pointer"
                        >
                          <p className="font-display font-semibold text-sm text-[var(--text-primary)]">{u.name ?? "—"}</p>
                          <p className="text-[0.7rem] text-[var(--text-muted)]">{u.email}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Badge type tabs */}
            <div className="mb-3">
              <label className="block text-[0.75rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-[0.05em] mb-1.5">Badge Type</label>
              <div className="flex gap-2">
                {(["builtin", "custom"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setBadgeType(t)}
                    className={[
                      "flex-1 py-2 rounded-lg text-sm font-display font-bold border transition-colors cursor-pointer",
                      badgeType === t
                        ? "bg-orange-500/10 border-orange-500/30 text-[var(--accent-orange)]"
                        : "bg-transparent border-[var(--border-subtle)] text-[var(--text-muted)]",
                    ].join(" ")}
                  >
                    {t === "builtin" ? "Built-in" : "Custom"}
                  </button>
                ))}
              </div>
            </div>

            {/* Badge picker */}
            {badgeType === "builtin" ? (
              <div className="mb-3">
                <label className="block text-[0.75rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-[0.05em] mb-1.5">Select Badge</label>
                <div className="relative">
                  <select
                    value={builtinType}
                    onChange={(e) => setBuiltinType(e.target.value)}
                    className="input-field w-full appearance-none pr-8"
                  >
                    {BUILTIN_BADGES.map((b) => (
                      <option key={b.type} value={b.type}>{b.icon} {b.label} (+{b.points} pts)</option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                </div>
              </div>
            ) : (
              <div className="mb-3">
                <label className="block text-[0.75rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-[0.05em] mb-1.5">Select Custom Badge</label>
                {badges.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)] py-2">No custom badges created yet.</p>
                ) : (
                  <div className="relative">
                    <select
                      value={customBadgeId}
                      onChange={(e) => setCustomBadgeId(e.target.value)}
                      className="input-field w-full appearance-none pr-8"
                      required={badgeType === "custom"}
                    >
                      <option value="">Select…</option>
                      {badges.map((b) => (
                        <option key={b.id} value={b.id}>{b.icon} {b.label} (+{b.points} pts)</option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                  </div>
                )}
              </div>
            )}

            {/* Admin note */}
            <div className="mb-4">
              <label className="block text-[0.75rem] font-display font-bold text-[var(--text-muted)] uppercase tracking-[0.05em] mb-1.5">Admin Note <span className="opacity-60 normal-case font-normal">(shown on badge, optional)</span></label>
              <input
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="e.g. Outstanding contribution to the community"
                className="input-field w-full"
              />
            </div>

            {awardMsg && (
              <div
                className="mb-3 px-3 py-2 rounded-lg text-sm font-display font-semibold"
                style={{
                  background: awardMsg.startsWith("Error") ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)",
                  color: awardMsg.startsWith("Error") ? "#ef4444" : "#10b981",
                  border: `1px solid ${awardMsg.startsWith("Error") ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)"}`,
                }}
              >
                {awardMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={awarding || !selectedUser || (badgeType === "custom" && !customBadgeId)}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send size={14} />
              {awarding ? "Awarding…" : "Award Badge"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
