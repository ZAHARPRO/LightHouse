"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Spade, XCircle, ShieldOff, Loader2, AlertTriangle, Crown, RotateCcw } from "lucide-react";

type RoomData = {
  id: string;
  status: string;
  variant: string;
  deckSize: number;
  maxPlayers: number;
  rated: boolean;
  fairPlay: boolean;
  hostName: string | null;
  winner: string | null;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  players: { userId: string; name: string | null; seatIdx: number; eloDelta: number | null; isDurak: boolean }[];
};

type Cheater = {
  id: string;
  name: string | null;
  image: string | null;
  durakCheaterCatches: number;
  durakCheaterBanned: boolean;
  durakElo: number;
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function DurakAdminClient({ rooms, cheaters }: { rooms: RoomData[]; cheaters: Cheater[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [statusF, setStatusF] = useState<"all" | "active" | "finished">("all");
  const [err, setErr] = useState<string | null>(null);

  async function act(action: string, key: string, body: object) {
    setBusy((b) => ({ ...b, [key]: true }));
    setErr(null);
    try {
      const res = await fetch("/api/admin/durak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      if (res.ok) router.refresh();
      else setErr((await res.json().catch(() => ({}))).error ?? "Error");
    } catch {
      setErr("Network error");
    } finally {
      setBusy((b) => {
        const n = { ...b };
        delete n[key];
        return n;
      });
    }
  }

  const list = rooms.filter((r) =>
    statusF === "all" ? true : statusF === "active" ? r.status !== "FINISHED" : r.status === "FINISHED",
  );
  const active = rooms.filter((r) => r.status !== "FINISHED").length;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Spade size={20} className="text-[var(--accent-orange)]" />
        <h1 className="font-display font-extrabold text-2xl tracking-tight text-[var(--text-primary)]">Durak Rooms</h1>
      </div>
      <p className="text-sm text-[var(--text-muted)] mb-6">Monitor games and manage caught cheaters</p>

      {err && (
        <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertTriangle size={15} />
          {err}
        </div>
      )}

      {/* Cheaters */}
      <h2 className="font-display font-bold text-sm text-[var(--text-secondary)] mb-3">Cheater Watchlist</h2>
      {cheaters.length === 0 ? (
        <p className="text-[var(--text-muted)] text-sm mb-8">No cheaters recorded.</p>
      ) : (
        <div className="flex flex-col gap-2 mb-8">
          {cheaters.map((c) => (
            <div key={c.id} className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5">
              {c.image ? (
                <Image src={c.image} alt="" width={28} height={28} className="rounded-full" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)]">
                  {c.name?.[0] ?? "?"}
                </div>
              )}
              <span className="text-sm font-display font-semibold text-[var(--text-primary)] flex-1 truncate">{c.name ?? "?"}</span>
              <span className="text-xs text-[var(--text-muted)]">ELO {c.durakElo}</span>
              <span className="text-xs font-bold text-amber-400">{c.durakCheaterCatches} catches</span>
              {c.durakCheaterBanned && (
                <span className="text-[0.65rem] font-bold text-red-400 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20">BANNED</span>
              )}
              {c.durakCheaterBanned && (
                <button
                  onClick={() => act("unban", "unban" + c.id, { userId: c.id })}
                  disabled={busy["unban" + c.id]}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  {busy["unban" + c.id] ? <Loader2 size={11} className="animate-spin" /> : <ShieldOff size={11} />}
                  Lift Ban
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Rooms */}
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-display font-bold text-sm text-[var(--text-secondary)]">Rooms</h2>
        <span className="text-xs text-blue-400 ml-2">{active} active</span>
        <div className="ml-auto flex gap-1.5">
          {(["all", "active", "finished"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusF(s)}
              className={[
                "px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors capitalize",
                statusF === s
                  ? "bg-[var(--accent-orange)]/15 border-[var(--accent-orange)]/40 text-[var(--accent-orange)]"
                  : "bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]",
              ].join(" ")}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <p className="text-center py-12 text-[var(--text-muted)] text-sm">No rooms.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((r) => (
            <div key={r.id} className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-500/10 border border-orange-500/20 text-orange-400">
                  {r.variant} · {r.deckSize}
                </span>
                {r.rated && <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">Rated</span>}
                {!r.fairPlay && <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-500/10 border border-purple-500/20 text-purple-400">Unfair</span>}
                {r.status === "WAITING" && <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400">Waiting</span>}
                {r.status === "PLAYING" && <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400 animate-pulse">Playing</span>}
                {r.status === "FINISHED" && <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">Finished</span>}
                <span className="ml-auto text-[0.62rem] font-mono text-[var(--text-muted)]">#{r.id.slice(-8)}</span>
                <span className="text-[0.62rem] text-[var(--text-muted)]">{fmt(r.createdAt)}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {r.players.map((p) => (
                  <span
                    key={p.userId}
                    className={[
                      "flex items-center gap-1 px-2 py-1 rounded-lg text-xs",
                      p.isDurak ? "bg-red-500/10 border border-red-500/20 text-red-300" : "bg-[var(--bg-secondary)] text-[var(--text-secondary)]",
                    ].join(" ")}
                  >
                    {p.isDurak ? "😩" : <Crown size={10} className="text-[var(--text-muted)]" />}
                    {p.name ?? "?"}
                    {p.eloDelta != null && (
                      <span className={p.eloDelta >= 0 ? "text-emerald-400" : "text-red-400"}>
                        {p.eloDelta >= 0 ? "+" : ""}
                        {p.eloDelta}
                      </span>
                    )}
                  </span>
                ))}
              </div>

              <div className="flex gap-2 flex-wrap">
                {r.status !== "FINISHED" && (
                  <button
                    onClick={() => act("close", "close" + r.id, { roomId: r.id })}
                    disabled={busy["close" + r.id]}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {busy["close" + r.id] ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
                    Force Close
                  </button>
                )}
                {r.rated && r.players.some((p) => p.eloDelta != null) && (
                  <button
                    onClick={() => act("revert-elo", "revert" + r.id, { roomId: r.id })}
                    disabled={busy["revert" + r.id]}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 disabled:opacity-50"
                  >
                    {busy["revert" + r.id] ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                    Revert ELO
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
