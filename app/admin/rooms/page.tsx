"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import {
  Swords, Bomb, RefreshCw, XCircle, RotateCcw, Clock,
  ChevronUp, ChevronDown, Minus, AlertTriangle, Loader2, CheckCircle2, Search,
} from "lucide-react";

type Room = {
  id: string;
  game: "chess" | "minesweeper";
  status: string;
  hostEloSnapshot: number | null;
  guestEloSnapshot: number | null;
  hostEloDelta: number | null;
  guestEloDelta: number | null;
  resultReverted: boolean;
  hostCurrentElo: number | null;
  guestCurrentElo: number | null;
  winner: string | null;
  winReason: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  host:  { id: string; name: string | null; image: string | null };
  guest: { id: string; name: string | null; image: string | null } | null;
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function dur(a: string | null, b: string | null) {
  if (!a || !b) return null;
  const s = Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function Delta({ delta, reverted }: { delta: number | null; reverted: boolean }) {
  if (reverted) return <span className="text-[0.62rem] text-amber-400 italic">reverted</span>;
  if (delta == null) return <span className="text-[var(--text-muted)] text-xs">—</span>;
  if (delta > 0) return <span className="flex items-center gap-0.5 text-emerald-400 text-xs font-bold"><ChevronUp size={11} />+{delta}</span>;
  if (delta < 0) return <span className="flex items-center gap-0.5 text-red-400 text-xs font-bold"><ChevronDown size={11} />{delta}</span>;
  return <span className="text-[var(--text-muted)] text-xs flex items-center gap-0.5"><Minus size={10} />0</span>;
}

function Avatar({ name, image }: { name: string | null; image: string | null }) {
  return image
    ? <Image src={image} alt="" width={20} height={20} className="rounded-full shrink-0 object-cover" />
    : <div className="w-5 h-5 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-[0.5rem] font-bold text-[var(--text-muted)] shrink-0">{name?.[0] ?? "?"}</div>;
}

export default function AdminRoomsPage() {
  const [rooms, setRooms]         = useState<Room[]>([]);
  const [loading, setLoading]     = useState(true);
  const [apiError, setApiError]   = useState<string | null>(null);
  const [statusF, setStatusF]     = useState<"all" | "active" | "finished">("all");
  const [gameF,   setGameF]       = useState<"all" | "chess" | "minesweeper">("all");
  const [search, setSearch]       = useState("");
  const [busy, setBusy]           = useState<Record<string, boolean>>({});
  const [rowErr, setRowErr]       = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await fetch("/api/admin/rooms");
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setApiError(d.error ?? `HTTP ${res.status}`);
        return;
      }
      setRooms(await res.json());
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function doAction(id: string, game: string, act: "close" | "revert") {
    const key = id + act;
    setBusy(b => ({ ...b, [key]: true }));
    setRowErr(e => { const n = { ...e }; delete n[key]; return n; });
    try {
      const res = await fetch("/api/admin/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: act, game, id }),
      });
      if (res.ok) {
        await load();
      } else {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setRowErr(e => ({ ...e, [key]: d.error ?? "Error" }));
      }
    } catch {
      setRowErr(e => ({ ...e, [key]: "Network error" }));
    } finally {
      setBusy(b => { const n = { ...b }; delete n[key]; return n; });
    }
  }

  // Client-side filtering
  const q = search.trim().toLowerCase();
  const list = rooms.filter(r => {
    const statusOk = statusF === "all"
      || (statusF === "active"   && r.status !== "FINISHED")
      || (statusF === "finished" && r.status === "FINISHED");
    const gameOk = gameF === "all" || r.game === gameF;
    const searchOk = !q
      || r.id.toLowerCase().includes(q)
      || r.host.name?.toLowerCase().includes(q)
      || r.guest?.name?.toLowerCase().includes(q);
    return statusOk && gameOk && searchOk;
  });

  const active   = rooms.filter(r => r.status !== "FINISHED").length;
  const finished = rooms.filter(r => r.status === "FINISHED").length;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display font-extrabold text-2xl tracking-tight text-[var(--text-primary)] mb-1">Rated Rooms</h1>
          <p className="text-sm text-[var(--text-muted)]">Monitor and manage rated matches — force-close or revert ELO</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-display font-semibold bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {apiError && (
        <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertTriangle size={15} />{apiError}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Active",   value: active,   color: "text-blue-400"  },
          { label: "Finished", value: finished,  color: "text-emerald-400" },
          { label: "Total",    value: rooms.length, color: "text-[var(--text-secondary)]" },
        ].map(s => (
          <div key={s.label} className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4">
            <p className={["font-display font-extrabold text-2xl leading-none mb-0.5", s.color].join(" ")}>{s.value}</p>
            <p className="text-xs text-[var(--text-muted)]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by player name or room ID…"
          className="w-full h-9 pl-8 pr-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-default)] placeholder:text-[var(--text-muted)]"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-xs text-[var(--text-muted)]">Status:</span>
        {(["all", "active", "finished"] as const).map(s => (
          <button key={s} onClick={() => setStatusF(s)}
            className={["px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors capitalize",
              statusF === s
                ? "bg-[var(--accent-orange)]/15 border-[var(--accent-orange)]/40 text-[var(--accent-orange)]"
                : "bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]",
            ].join(" ")}>{s}</button>
        ))}
        <span className="text-[var(--border-default)]">|</span>
        <span className="text-xs text-[var(--text-muted)]">Game:</span>
        {(["all", "chess", "minesweeper"] as const).map(g => (
          <button key={g} onClick={() => setGameF(g)}
            className={["px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors capitalize",
              gameF === g
                ? g === "chess"
                  ? "bg-violet-500/15 border-violet-500/40 text-violet-400"
                  : g === "minesweeper"
                  ? "bg-red-500/15 border-red-500/40 text-red-400"
                  : "bg-[var(--accent-orange)]/15 border-[var(--accent-orange)]/40 text-[var(--accent-orange)]"
                : "bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]",
            ].join(" ")}>{g}</button>
        ))}
      </div>

      {/* List */}
      {loading && rooms.length === 0 ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-[var(--text-muted)]" /></div>
      ) : list.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)] text-sm">
          {rooms.length === 0 ? "No rated rooms found in the database" : "No rooms match the current filter"}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map(room => {
            const isChess   = room.game === "chess";
            const cancelled = room.winReason === "cancelled";
            const hostWins  = !cancelled && room.hostEloDelta != null && room.hostEloDelta > 0;
            const guestWins = !cancelled && room.guestEloDelta != null && room.guestEloDelta > 0;
            const canClose  = room.status !== "FINISHED";
            const canRevert = room.status === "FINISHED" && !room.resultReverted
              && room.hostEloDelta != null && !cancelled;

            return (
              <div key={room.id}
                className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4 flex flex-col gap-3">

                {/* Top row */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className={["flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border",
                    isChess
                      ? "bg-violet-500/10 border-violet-500/20 text-violet-400"
                      : "bg-red-500/10 border-red-500/20 text-red-400"].join(" ")}>
                    {isChess ? <Swords size={11} /> : <Bomb size={11} />}
                    {isChess ? "Chess" : "Minesweeper"}
                  </span>

                  {room.status === "WAITING" && <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400">Waiting</span>}
                  {room.status === "PLAYING" && <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400 animate-pulse">Playing</span>}
                  {room.status === "FINISHED" && !cancelled && <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">Finished</span>}
                  {cancelled && <span className="px-2 py-0.5 rounded text-xs font-bold bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-muted)]">Cancelled</span>}
                  {room.resultReverted && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400">
                      <RotateCcw size={9} /> ELO Reverted
                    </span>
                  )}

                  <span className="ml-auto text-[0.62rem] font-mono text-[var(--text-muted)]">#{room.id.slice(-8)}</span>
                  <span className="text-[0.62rem] text-[var(--text-muted)]">{fmt(room.createdAt)}</span>
                  {room.startedAt && room.endedAt && (
                    <span className="flex items-center gap-1 text-[0.62rem] text-[var(--text-muted)]">
                      <Clock size={9} />{dur(room.startedAt, room.endedAt)}
                    </span>
                  )}
                </div>

                {/* Players table */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Host",  player: room.host,  snap: room.hostEloSnapshot,  delta: room.hostEloDelta,  cur: room.hostCurrentElo,  wins: hostWins  },
                    { label: "Guest", player: room.guest, snap: room.guestEloSnapshot, delta: room.guestEloDelta, cur: room.guestCurrentElo, wins: guestWins },
                  ].map(({ label, player, snap, delta, cur, wins }) => (
                    <div key={label} className="bg-[var(--bg-secondary)] rounded-lg px-3 py-2 flex flex-col gap-1">
                      <p className="text-[0.58rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{label}</p>
                      {player ? (
                        <>
                          <div className="flex items-center gap-1.5">
                            <Avatar name={player.name} image={player.image} />
                            <span className="text-sm text-[var(--text-primary)] truncate font-medium">{player.name ?? "?"}</span>
                            {wins && <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] flex-wrap">
                            <span>ELO: <span className="text-[var(--text-secondary)]">
                              {snap ?? (cur != null && delta != null ? cur - delta : "?")}
                            </span></span>
                            <Delta delta={delta} reverted={room.resultReverted} />
                            {cur != null && <span>→ <span className="text-[var(--text-secondary)]">{cur}</span></span>}
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-[var(--text-muted)] py-1">—</p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Winner line */}
                {room.winner && !cancelled && (
                  <p className="text-xs text-[var(--text-muted)]">
                    Winner: <span className="text-[var(--text-secondary)] font-semibold">{room.winner}</span>
                    {room.winReason && <> · <span className="capitalize">{room.winReason}</span></>}
                  </p>
                )}

                {/* Row error */}
                {(rowErr[room.id + "close"] || rowErr[room.id + "revert"]) && (
                  <div className="flex items-center gap-1.5 text-xs text-red-400">
                    <AlertTriangle size={12} />
                    {rowErr[room.id + "close"] || rowErr[room.id + "revert"]}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {canClose && (
                    <button
                      onClick={() => doAction(room.id, room.game, "close")}
                      disabled={busy[room.id + "close"]}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50">
                      {busy[room.id + "close"] ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
                      Force Close
                    </button>
                  )}
                  {canRevert && (
                    <button
                      onClick={() => doAction(room.id, room.game, "revert")}
                      disabled={busy[room.id + "revert"]}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50">
                      {busy[room.id + "revert"] ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                      Revert ELO
                    </button>
                  )}
                  {!canClose && !canRevert && (
                    <span className="text-[0.65rem] text-[var(--text-muted)] italic">
                      {room.resultReverted ? "ELO reverted" : cancelled ? "Cancelled, no ELO applied" : "No actions available"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
