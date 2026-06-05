"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Eye, Crown, ShieldAlert, Hand, Check, X, Play, Bot, Plus, Trash2, Copy } from "lucide-react";
import DurakCard from "@/components/DurakCard";
import GameChat, { type ChatMsg } from "@/components/GameChat";
import ConnectionBadge, { type ConnStatus } from "@/components/ConnectionBadge";
import type { Card, TableSlot } from "@/lib/durak";
import { SUIT_SYMBOL, SUIT_IS_RED, cardsEqual, canAttack, canDefend, canTransfer } from "@/lib/durak";
import type { MoveRecord } from "@/lib/durak-engine";

function MoveTimer({ lastMoveAt, timeLimitSec, isMyTurn }: { lastMoveAt: string | null; timeLimitSec: number; isMyTurn: boolean }) {
  const [left, setLeft] = useState(() => {
    if (!lastMoveAt) return timeLimitSec * 1000;
    return Math.max(0, timeLimitSec * 1000 - (Date.now() - new Date(lastMoveAt).getTime()));
  });

  useEffect(() => {
    const id = setInterval(() => {
      if (!lastMoveAt) return;
      setLeft(Math.max(0, timeLimitSec * 1000 - (Date.now() - new Date(lastMoveAt).getTime())));
    }, 250);
    return () => clearInterval(id);
  }, [lastMoveAt, timeLimitSec]);

  const secs = Math.ceil(left / 1000);
  const pct  = left / (timeLimitSec * 1000);
  const color = pct > 0.5 ? "#22c55e" : pct > 0.25 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative w-6 h-6">
        <svg viewBox="0 0 24 24" className="w-6 h-6 -rotate-90">
          <circle cx="12" cy="12" r="10" fill="none" stroke="var(--border-subtle)" strokeWidth="2.5" />
          <circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth="2.5"
            strokeDasharray={`${2 * Math.PI * 10}`}
            strokeDashoffset={`${2 * Math.PI * 10 * (1 - pct)}`}
            style={{ transition: "stroke-dashoffset 0.25s linear, stroke 0.25s" }} />
        </svg>
      </div>
      <span className={["font-mono font-bold text-xs tabular-nums", isMyTurn ? "" : "text-[var(--text-muted)]"].join(" ")}
        style={{ color: isMyTurn ? color : undefined }}>
        {secs}s
      </span>
    </div>
  );
}

function FlyingCard({ from, to }: { from: { x: number; y: number }; to: { x: number; y: number } }) {
  const [arrived, setArrived] = useState(false);
  useEffect(() => { const f = requestAnimationFrame(() => setArrived(true)); return () => cancelAnimationFrame(f); }, []);
  const W = 52, H = 74;
  return (
    <div style={{
      position: "fixed",
      left: (arrived ? to.x : from.x) - W / 2,
      top:  (arrived ? to.y : from.y) - H / 2,
      transition: arrived ? "left 0.35s cubic-bezier(.2,1.3,.5,1), top 0.35s cubic-bezier(.2,1.3,.5,1), opacity 0.15s 0.3s" : "none",
      opacity: arrived ? 0 : 1,
      zIndex: 9999,
      pointerEvents: "none",
      transform: arrived ? "scale(0.7) rotate(8deg)" : "scale(1) rotate(0deg)",
    }}>
      <DurakCard faceDown size="sm" />
    </div>
  );
}

type PlayerData = {
  userId: string;
  name: string | null;
  image: string | null;
  seatIdx: number;
  cardCount: number;
  isOut: boolean;
  isReady: boolean;
  timeMs: number | null;
  elo: number;
  eloDelta: number | null;
  isBot?: boolean;
  botDifficulty?: string;
};

type RoomData = {
  id: string;
  status: string;
  variant: string;
  deckSize: number;
  maxPlayers: number;
  timeControl: string;
  throwRule: string;
  rated: boolean;
  fairPlay: boolean;
  hostId: string;
  trumpCard: Card | null;
  trumpSuit: string | null;
  deckCount: number;
  table: TableSlot[];
  discardCount: number;
  attackerIdx: number;
  defenderIdx: number;
  phase: string;
  players: PlayerData[];
  myHand: Card[];
  myRole: "player" | "spectator";
  mySeatIdx: number | null;
  pendingCheat: { type: string; cheaterName: string } | null;
  peekedCard: Card | null;
  winner: string | null;
  chat: ChatMsg[];
  spectatorCount: number;
  botsJson: string;
  movesJson: string;
  lastMoveAt: string | null;
};

const API = "/api/durak-rooms";

export default function DurakRoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;
  const router = useRouter();
  const { data: session } = useSession();
  const myId = session?.user?.id ?? "";
  const t = useTranslations("durak");

  const [room, setRoom] = useState<RoomData | null>(null);
  const [conn, setConn] = useState<ConnStatus>("ok");
  const [selected, setSelected] = useState<Card | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragCard, setDragCard] = useState<Card | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [botDifficulties, setBotDifficulties] = useState<Record<number, string>>({});
  const [catchWindow, setCatchWindow] = useState<number>(0); // ms remaining
  const [showPeek, setShowPeek] = useState<Card | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shakeCardKey, setShakeCardKey] = useState<string | null>(null);
  const [previewMove, setPreviewMove] = useState<{ action: string; card?: { suit: string; rank: string }; name: string } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const roomUrl = typeof window !== "undefined" ? `${window.location.origin}/games/durak/online/${roomId}` : "";
  function handleCopy() {
    navigator.clipboard.writeText(roomUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  async function handleCancelRoom() {
    await fetch(`${API}/${roomId}`, { method: "DELETE" });
    router.push("/games/durak/online");
  }
  // Dealing animation — tracks which cards have been "dealt" visually
  const [dealStep, setDealStep] = useState(999); // start large (no anim until transition)
  const prevStatusRef = useRef<string | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const lastFetch = useRef(0);

  const fetchRoom = useCallback(async () => {
    try {
      const res = await fetch(`${API}/${roomId}`, { cache: "no-store" });
      if (res.ok) {
        const d = (await res.json()) as RoomData;
        setRoom(d);
        setConn("ok");
        lastFetch.current = Date.now();
        if (d.peekedCard) setShowPeek(d.peekedCard);
      } else if (res.status === 404) {
        setErr(t("roomNotFound"));
      }
    } catch {
      setConn("lost");
    }
  }, [roomId, t]);

  // SSE + fallback poll
  useEffect(() => {
    fetchRoom();
    const es = new EventSource(`${API}/${roomId}/sse`);
    esRef.current = es;
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as { type: string; cheaterName?: string };
        if (ev.type === "update") fetchRoom();
        if (ev.type === "cheat_alert") {
          setCatchWindow(3000);
        }
        if (ev.type === "catch") fetchRoom();
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => setConn("slow");

    const poll = setInterval(() => {
      if (Date.now() - lastFetch.current > 10_000) fetchRoom();
    }, 5000);
    const ping = setInterval(() => {
      fetch(`${API}/${roomId}/ping`, { method: "POST" }).catch(() => {});
    }, 20_000);

    return () => {
      es.close();
      clearInterval(poll);
      clearInterval(ping);
    };
  }, [roomId, fetchRoom]);

  // Refs for dealing + card-play animations
  const onlineDeckRef    = useRef<HTMLDivElement>(null);
  const onlineMyHandRef  = useRef<HTMLDivElement>(null);
  const onlineTableRef   = useRef<HTMLDivElement>(null);
  const onlineOppRef     = useRef<HTMLDivElement>(null);
  const onlineFlyIdRef   = useRef(0);
  const [onlineFlyCards, setOnlineFlyCards] = useState<{ id: number; from: {x:number;y:number}; to: {x:number;y:number} }[]>([]);
  const prevTableLenRef  = useRef(0);
  const isDealDone       = dealStep >= 999 || (room ? dealStep >= room.players.length * 6 : true);

  // Dealing animation: fires when room transitions WAITING → PLAYING
  useEffect(() => {
    if (!room) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = room.status;
    if (prev === "WAITING" && room.status === "PLAYING") {
      const sortedPlayers = [...room.players].sort((a, b) => a.seatIdx - b.seatIdx);
      const total = sortedPlayers.length * 6;
      setDealStep(0);
      setOnlineFlyCards([]);
      let step = 0;
      const id = setInterval(() => {
        step++;
        setDealStep(step);
        // Launch flying card from deck position
        if (onlineDeckRef.current) {
          const deckRect = onlineDeckRef.current.getBoundingClientRect();
          const from = { x: deckRect.left + deckRect.width / 2, y: deckRect.top + deckRect.height / 2 };
          // Target: if it's the current user's card, aim at their hand; otherwise generic upward
          const targetIsMe = (step - 1) % sortedPlayers.length === sortedPlayers.findIndex(p => p.userId === myId);
          const toEl = targetIsMe ? onlineMyHandRef.current : null;
          const toRect = toEl?.getBoundingClientRect();
          const to = toRect
            ? { x: toRect.left + toRect.width / 2, y: toRect.top + toRect.height / 2 }
            : { x: from.x + (Math.random() - 0.5) * 200, y: from.y - 150 };
          const fid = ++onlineFlyIdRef.current;
          setOnlineFlyCards(prev => [...prev, { id: fid, from, to }]);
          setTimeout(() => setOnlineFlyCards(prev => prev.filter(c => c.id !== fid)), 450);
        }
        if (step >= total) clearInterval(id);
      }, 220);
      return () => clearInterval(id);
    }
  }, [room?.status, myId]); // eslint-disable-line react-hooks/exhaustive-deps

  // When a new card appears on the table (opponent played), fly it from opponent area to table
  useEffect(() => {
    if (!room || room.status !== "PLAYING") return;
    const newLen = room.table.length;
    if (newLen > prevTableLenRef.current && onlineOppRef.current && onlineTableRef.current) {
      const fromRect = onlineOppRef.current.getBoundingClientRect();
      const toRect   = onlineTableRef.current.getBoundingClientRect();
      const from = { x: fromRect.left + fromRect.width / 2,  y: fromRect.top + fromRect.height / 2 };
      const to   = { x: toRect.left   + toRect.width   / 2,  y: toRect.top   + toRect.height   / 2 };
      const fid  = ++onlineFlyIdRef.current;
      setOnlineFlyCards(prev => [...prev, { id: fid, from, to }]);
      setTimeout(() => setOnlineFlyCards(prev => prev.filter(c => c.id !== fid)), 500);
    }
    prevTableLenRef.current = newLen;
  }, [room?.table.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pending-cheat catch window countdown
  useEffect(() => {
    if (!room?.pendingCheat && catchWindow === 0) return;
    if (room?.pendingCheat && catchWindow === 0) setCatchWindow(3000);
    const i = setInterval(() => {
      setCatchWindow((w) => {
        const n = Math.max(0, w - 100);
        return n;
      });
    }, 100);
    return () => clearInterval(i);
  }, [room?.pendingCheat, catchWindow]);

  // Auto-scroll log to bottom when new moves arrive
  const movesLen = room ? (() => { try { return (JSON.parse(room.movesJson ?? "[]") as unknown[]).length; } catch { return 0; } })() : 0;
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [movesLen]);

  async function post(path: string, body?: object): Promise<boolean> {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`${API}/${roomId}/${path}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error ?? "Error");
        setBusy(false);
        return false;
      }
      setBusy(false);       // unblock UI immediately
      fetchRoom();          // refresh in background (SSE will also trigger it)
      return true;
    } catch {
      setErr("Network error");
      setBusy(false);
      return false;
    }
  }

  if (err && !room) {
    return (
      <main className="max-w-xl mx-auto px-4 py-20 text-center">
        <p className="text-[var(--text-muted)] mb-4">{err}</p>
        <Link href="/games/durak/online" className="text-[var(--accent-orange)]">
          ← {t("backToLobby")}
        </Link>
      </main>
    );
  }
  if (!room) {
    return (
      <main className="flex justify-center py-32">
        <Loader2 size={28} className="animate-spin text-[var(--text-muted)]" />
      </main>
    );
  }

  const me = room.players.find((p) => p.userId === myId) ?? null;
  const isHost = room.hostId === myId;
  const isPlayer = room.myRole === "player";
  const isDefender = room.mySeatIdx === room.defenderIdx;
  const isAttackerSide = isPlayer && room.mySeatIdx !== room.defenderIdx && !me?.isOut;
  const others = room.players.filter((p) => p.userId !== myId).sort((a, b) => a.seatIdx - b.seatIdx);

  // ── WAITING lobby view ──────────────────────────────────────────────
  if (room.status === "WAITING") {
    type BotEntry = { seatIdx: number; difficulty: string };
    const currentBots: BotEntry[] = (() => { try { return JSON.parse(room.botsJson ?? "[]"); } catch { return []; } })();

    async function patchRoom(data: Record<string, unknown>) {
      await fetch(`${API}/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      await fetchRoom();
    }

    const TC_OPTIONS = [
      { value: "none", icon: "∞", label: "∞" },
      { value: "15",   icon: "⚡", label: "15s" },
      { value: "30",   icon: "⏱",  label: "30s" },
      { value: "60",   icon: "🕐", label: "60s" },
    ];
    const S_ACTIVE = "bg-orange-500/15 border-orange-500/40 text-[var(--accent-orange)]";
    const S_IDLE   = "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]";
    const sp = (active: boolean) => `px-2.5 py-1 rounded-md text-[0.7rem] font-display font-semibold border transition-all ${active ? S_ACTIVE : S_IDLE}`;

    async function addBot(seat: number) {
      const diff = botDifficulties[seat] ?? "medium";
      await post("bot", { action: "add", seatIdx: seat, difficulty: diff });
    }
    async function removeBot(seat: number) {
      await post("bot", { action: "remove", seatIdx: seat });
    }

    const totalOccupied = room.players.length + currentBots.length;

    return (
      <main className="max-w-xl mx-auto px-4 py-12">
        <Link href="/games/durak/online" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm">
          ← {t("backToLobby")}
        </Link>
        <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)] mt-3 mb-1">{t("waitingRoom")}</h1>
        <p className="text-[var(--text-muted)] text-sm mb-4">
          {t(room.variant === "perevodnoy" ? "perevodnoy" : "podkidnoy")} · {room.deckSize} · {room.maxPlayers} {t("playersLabel")} ·{" "}
          {room.fairPlay ? t("fairPlay") : t("unfairPlay")}
          {room.rated && <> · ⭐ {t("rated")}</>}
        </p>

        {/* ── Host settings panel ── */}
        {isHost && (
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-4 mb-5 flex flex-col gap-3">
            {/* Time */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--text-muted)] w-20 shrink-0">{t("timePerMove")}</span>
              <div className="flex gap-1.5 flex-wrap">
                {TC_OPTIONS.map(o => (
                  <button key={o.value} className={sp(room.timeControl === o.value)} onClick={() => patchRoom({ timeControl: o.value })}>
                    {o.icon} {o.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Deck + Players */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--text-muted)] w-20 shrink-0">{t("deck")}</span>
              <div className="flex gap-1.5">
                <button className={sp(room.deckSize === 36)} onClick={() => patchRoom({ deckSize: 36 })}>36</button>
                <button className={sp(room.deckSize === 52)} onClick={() => patchRoom({ deckSize: 52 })}>52</button>
              </div>
              <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--text-muted)] ml-3">{t("players")}</span>
              <div className="flex gap-1.5">
                {[2,3,4,5,6].map(n => (
                  <button key={n} className={sp(room.maxPlayers === n)} onClick={() => patchRoom({ maxPlayers: n })}>{n}</button>
                ))}
              </div>
            </div>
            {/* Play mode + Variant */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--text-muted)] w-20 shrink-0">{t("playMode")}</span>
              <div className="flex gap-1.5">
                <button className={sp(room.fairPlay)} onClick={() => patchRoom({ fairPlay: true })}>{t("fairPlay")}</button>
                <button className={sp(!room.fairPlay)} onClick={() => patchRoom({ fairPlay: false })}>{t("unfairPlay")}</button>
              </div>
              <button
                className={[sp(room.variant === "perevodnoy"), "flex items-center gap-1.5 ml-2"].join(" ")}
                onClick={() => patchRoom({ variant: room.variant === "perevodnoy" ? "podkidnoy" : "perevodnoy" })}
              >
                <span className={[
                  "w-3 h-3 rounded-sm border flex items-center justify-center text-[0.5rem] shrink-0",
                  room.variant === "perevodnoy" ? "bg-[var(--accent-orange)] border-[var(--accent-orange)] text-white" : "border-current opacity-50",
                ].join(" ")}>
                  {room.variant === "perevodnoy" && "✓"}
                </span>
                {t("perevodnoy")}
              </button>
            </div>
            {/* Throw rule (4+ players) */}
            {room.maxPlayers >= 4 && (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--text-muted)] w-20 shrink-0">{t("throwRule")}</span>
                <div className="flex gap-1.5">
                  <button className={sp(room.throwRule === "all")} onClick={() => patchRoom({ throwRule: "all" })}>{t("throwAll")}</button>
                  <button className={sp(room.throwRule === "neighbors")} onClick={() => patchRoom({ throwRule: "neighbors" })}>{t("throwNeighbors")}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Invite link */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 mb-6">
          <p className="text-[0.7rem] text-[var(--text-muted)] font-display font-semibold uppercase tracking-wider mb-2">Invite link</p>
          <div className="flex items-center gap-2">
            <p className="flex-1 text-xs font-mono text-[var(--text-secondary)] truncate">{roomUrl}</p>
            <button onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[0.7rem] font-display font-semibold transition-colors hover:text-[var(--text-primary)] shrink-0">
              {copied ? <><Check size={11} className="text-green-400" /> Copied</> : <><Copy size={11} /> Copy</>}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 mb-6">
          {Array.from({ length: room.maxPlayers }).map((_, seat) => {
            const p = room.players.find((pl) => pl.seatIdx === seat);
            const bot = currentBots.find((b) => b.seatIdx === seat);
            const isEmpty = !p && !bot;
            return (
              <div
                key={seat}
                className="flex items-center gap-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5"
              >
                {p ? (
                  <>
                    {p.image ? (
                      <Image src={p.image} alt="" width={32} height={32} className="rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-[var(--accent-orange)] font-bold text-xs">
                        {p.name?.[0] ?? "?"}
                      </div>
                    )}
                    <span className="font-display font-semibold text-[var(--text-primary)] text-sm flex-1">
                      {p.name ?? "?"} {p.userId === room.hostId && <Crown size={12} className="inline text-yellow-400" />}
                    </span>
                    {p.userId === room.hostId ? (
                      <span className="text-[0.65rem] text-[var(--text-muted)]">{t("host")}</span>
                    ) : p.isReady ? (
                      <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold">
                        <Check size={13} /> {t("ready")}
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)] text-xs">{t("notReady")}</span>
                    )}
                  </>
                ) : bot ? (
                  <>
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                      <Bot size={16} className="text-purple-400" />
                    </div>
                    <span className="font-display font-semibold text-[var(--text-secondary)] text-sm flex-1">
                      Bot · {bot.difficulty}
                    </span>
                    {isHost && (
                      <div className="flex items-center gap-2">
                        <select
                          value={bot.difficulty}
                          onChange={(e) => {
                            // Update difficulty: remove then re-add
                            removeBot(seat).then(() => {
                              setBotDifficulties((prev) => ({ ...prev, [seat]: e.target.value }));
                              setTimeout(() => addBot(seat), 100);
                            });
                          }}
                          className="text-xs bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-2 py-1 text-[var(--text-secondary)]"
                        >
                          <option value="easy">{t("easy")}</option>
                          <option value="medium">{t("medium")}</option>
                          <option value="hard">{t("hard")}</option>
                        </select>
                        <button
                          onClick={() => removeBot(seat)}
                          disabled={busy}
                          className="p-1.5 rounded-lg hover:bg-red-500/15 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                          title="Remove bot"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-[var(--text-muted)] text-sm italic flex-1">{t("emptySeat")}</span>
                    {isHost && (
                      <div className="flex items-center gap-2">
                        <select
                          value={botDifficulties[seat] ?? "medium"}
                          onChange={(e) => setBotDifficulties((prev) => ({ ...prev, [seat]: e.target.value }))}
                          className="text-xs bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-2 py-1 text-[var(--text-secondary)]"
                        >
                          <option value="easy">{t("easy")}</option>
                          <option value="medium">{t("medium")}</option>
                          <option value="hard">{t("hard")}</option>
                        </select>
                        <button
                          onClick={() => addBot(seat)}
                          disabled={busy}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-semibold hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                        >
                          <Plus size={12} /> Bot
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {err && <p className="text-red-400 text-sm mb-3">{err}</p>}

        <div className="flex gap-2">
          {isPlayer && !isHost && (
            <button
              onClick={() => post("ready")}
              disabled={busy}
              className={[
                "flex items-center gap-1.5 px-5 py-2 rounded-xl font-display font-bold text-sm transition-opacity disabled:opacity-50",
                me?.isReady ? "bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)]" : "bg-emerald-500 text-white",
              ].join(" ")}
            >
              {me?.isReady ? <X size={15} /> : <Check size={15} />}
              {me?.isReady ? t("cancelReady") : t("imReady")}
            </button>
          )}
          {isHost && (
            <button
              onClick={() => post("start")}
              disabled={busy || totalOccupied < 2}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Play size={15} /> {t("startGame")}
            </button>
          )}
          {!isPlayer && <p className="text-[var(--text-muted)] text-sm py-2">{t("spectating")}</p>}
        </div>
      </main>
    );
  }

  // ── PLAYING / FINISHED view ─────────────────────────────────────────
  const trumpSuit = room.trumpSuit as keyof typeof SUIT_SYMBOL | null;
  const finished = room.status === "FINISHED";
  const durakPlayer = room.winner ? room.players.find((p) => p.userId === room.winner) : null;
  const iAmDurak = room.winner === myId;

  function onCardClick(card: Card) {
    if (!isPlayer || finished) return;
    if (selected && cardsEqual(selected, card)) setSelected(null);
    else setSelected(card);
  }

  async function doAttack(card?: Card) {
    const c = card ?? selected;
    if (!c) return;
    if (await post("move", { action: "attack", card: c })) setSelected(null);
  }
  async function doThrow(card?: Card) {
    const c = card ?? selected;
    if (!c) return;
    if (await post("move", { action: "throw", card: c })) setSelected(null);
  }
  async function doTransfer() {
    if (!selected) return;
    if (await post("move", { action: "transfer", card: selected })) setSelected(null);
  }
  async function doDefend(slotIdx: number, card?: Card) {
    const c = card ?? selected;
    if (!c) return;
    if (await post("move", { action: "defend", card: c, attackSlotIdx: slotIdx })) setSelected(null);
  }
  async function doTake() {
    await post("move", { action: "take" });
  }
  async function doPass() {
    await post("move", { action: "pass" });
  }

  const canCatch = room.pendingCheat && catchWindow > 0 && isPlayer;

  function shakeCard(key: string) {
    setShakeCardKey(key);
    setTimeout(() => setShakeCardKey(null), 500);
  }

  const trumpSuitStr = (room.trumpSuit ?? "S") as "S" | "H" | "D" | "C";

  function cardIsPlayable(card: Card): boolean {
    if (!room || !isPlayer || finished) return false;
    if (isAttackerSide && room.phase === "attack") return canAttack(card, room.table);
    if (isDefender && room.phase === "defense") {
      if (room.variant === "perevodnoy") {
        const nextDef = room.players.find(p => p.seatIdx !== room.defenderIdx && p.seatIdx !== room.attackerIdx && !p.isOut);
        if (nextDef && canTransfer(card, room.table, "perevodnoy", nextDef.cardCount)) return true;
      }
      return room.table.some(s => !s.defense && canDefend(s.attack, card, trumpSuitStr));
    }
    return false;
  }

  const moves: MoveRecord[] = (() => { try { return JSON.parse(room.movesJson ?? "[]"); } catch { return []; } })();

  return (
    <>
    <style>{`
      @keyframes durak-deal {
        from { transform: translateY(-48px) rotate(-6deg) scale(0.85); opacity: 0; }
        to   { transform: translateY(0px)  rotate(0deg)  scale(1);    opacity: 1; }
      }
      .durak-card-in { animation: durak-deal 0.22s cubic-bezier(0.34,1.3,0.64,1) both; }
    `}</style>
    {/* Flying cards during deal animation */}
    {onlineFlyCards.map(fc => <FlyingCard key={fc.id} from={fc.from} to={fc.to} />)}
    <main className="max-w-4xl mx-auto px-2 pt-2 pb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          {isHost
            ? <button onClick={handleCancelRoom} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm">{t("cancelRoom")}</button>
            : <button onClick={() => router.push("/games/durak/online")} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm">← {t("leaveRoom")}</button>}
        </div>
        <div className="flex items-center gap-3">
          {room.spectatorCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
              <Eye size={12} /> {room.spectatorCount}
            </span>
          )}
          <ConnectionBadge status={conn} />
        </div>
      </div>

      {/* Cheat alert banner */}
      {canCatch && (
        <div className="mb-3 flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-red-500/15 border border-red-500/40 animate-pulse">
          <span className="flex items-center gap-2 text-red-300 text-sm font-display font-bold">
            <ShieldAlert size={16} /> {t("cheatSuspicion")}
          </span>
          <button
            onClick={() => post("catch")}
            disabled={busy}
            className="px-4 py-1.5 rounded-lg bg-red-500 text-white font-display font-bold text-sm hover:opacity-90 disabled:opacity-50"
          >
            {t("caught")} ({(catchWindow / 1000).toFixed(1)}s)
          </button>
        </div>
      )}

      {/* Peek reveal modal (cheater only) */}
      {showPeek && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowPeek(null)}>
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-6 flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-[var(--text-secondary)] font-display font-bold text-sm">{t("peekedCard")}</p>
            <DurakCard card={showPeek} size="lg" />
            <button onClick={() => setShowPeek(null)} className="mt-1 text-[var(--accent-orange)] text-sm font-bold">
              {t("close")}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_160px] gap-2">
        {/* ── Table area ── */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-2 flex flex-col">
          {/* Opponents — single scrollable row */}
          <div ref={onlineOppRef} className="flex items-center gap-2 mb-3 overflow-x-auto pb-1 [scrollbar-width:none]">
            {others.map((p) => {
              const isAtk = p.seatIdx === room.attackerIdx;
              const isDef = p.seatIdx === room.defenderIdx;
              const sortedSeats = [...room.players].sort((a, b) => a.seatIdx - b.seatIdx);
              const pos = sortedSeats.findIndex(s => s.userId === p.userId);
              return (
                <div
                  key={p.userId}
                  className={[
                    "flex items-center gap-1.5 px-2 py-1 rounded-lg border shrink-0 transition-all",
                    p.isOut   ? "opacity-40 bg-[var(--bg-secondary)] border-[var(--border-subtle)]"
                    : isAtk   ? "bg-orange-500/10 border-orange-500/30"
                    : isDef   ? "bg-red-500/10 border-red-500/30"
                    :           "bg-[var(--bg-secondary)] border-[var(--border-subtle)]",
                  ].join(" ")}
                >
                  {/* Avatar */}
                  {p.isBot ? (
                    <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                      <Bot size={10} className="text-purple-400" />
                    </div>
                  ) : p.image ? (
                    <Image src={p.image} alt="" width={20} height={20} className="rounded-full shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-[0.5rem] shrink-0">
                      {p.name?.[0] ?? "?"}
                    </div>
                  )}

                  <div className="flex flex-col gap-0 min-w-0">
                    {/* Name + role */}
                    <div className="flex items-center gap-1">
                      <span className="text-[0.65rem] font-display font-semibold text-[var(--text-primary)] max-w-[80px] truncate leading-tight">
                        {p.name ?? "?"}
                      </span>
                      {isAtk && <span className="text-[0.5rem] font-bold text-orange-400">▲</span>}
                      {isDef && <span className="text-[0.5rem] font-bold text-red-400">🛡</span>}
                      {p.isOut && <span className="text-[0.5rem] font-bold text-emerald-400">✓</span>}
                    </div>

                    {/* Cards + count */}
                    <div className="flex items-center gap-1">
                      <div className="flex -space-x-3">
                        {Array.from({ length: Math.min(p.cardCount, 5) }).map((_, i) => {
                          const di = i * room.players.length + Math.max(0, pos);
                          const cardVisible = dealStep > di;
                          return (
                            <div key={i} className={cardVisible && dealStep <= di + 1 ? "durak-card-in" : ""} style={{ opacity: cardVisible ? 1 : 0 }}>
                              <DurakCard faceDown size="xs" />
                            </div>
                          );
                        })}
                        {p.cardCount > 5 && <span className="text-[0.5rem] text-[var(--text-muted)] ml-0.5 self-center">+{p.cardCount - 5}</span>}
                      </div>
                      <span className={[
                        "text-[0.6rem] font-mono font-bold tabular-nums",
                        !isDealDone ? "opacity-0" : p.cardCount === 0 ? "text-green-400" : p.cardCount <= 3 ? "text-yellow-400" : "text-[var(--text-muted)]"
                      ].join(" ")}>
                        {isDealDone ? p.cardCount : "?"}
                      </span>
                      {room.timeControl !== "none" && (isAtk || isDef) && !finished && (
                        <MoveTimer lastMoveAt={room.lastMoveAt} timeLimitSec={Number(room.timeControl)} isMyTurn={false} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Deck + Table in one row */}
          <div className="flex gap-3 mb-3">
            {/* Left column: deck / trump / discard / pass */}
            <div className="flex flex-col items-center gap-2 shrink-0 w-[80px]">
              {/* Deck with trump card peeking */}
              <div className="relative" ref={onlineDeckRef} style={{ width: 70, height: 100 }}>
                {room.trumpCard && (
                  <DurakCard card={room.trumpCard} size="md"
                    style={{ position: "absolute", left: 16, top: 10, transform: "rotate(90deg)", zIndex: 0 }} />
                )}
                {room.deckCount > 0 ? (
                  <>
                    <DurakCard faceDown size="md" style={{ position: "absolute", left: 0, top: 0, zIndex: 1 }} />
                    <div className={[
                      "absolute -top-2 -right-2 min-w-[22px] h-[22px] rounded-full flex items-center justify-center text-[0.65rem] font-extrabold border-2 border-[var(--bg-elevated)] z-10",
                      room.deckCount < 6  ? "bg-red-500 text-white"
                      : room.deckCount < 16 ? "bg-yellow-400 text-black"
                      :                       "bg-emerald-500 text-white"
                    ].join(" ")}>
                      {room.deckCount}
                    </div>
                  </>
                ) : (
                  <div className="w-[70px] h-[100px] rounded-lg border border-dashed border-[var(--border-subtle)] flex items-center justify-center opacity-30 text-2xl">🂠</div>
                )}
              </div>

              {/* Trump suit */}
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-2xl leading-none"
                  style={{ color: trumpSuit && SUIT_IS_RED[trumpSuit] ? "#dc2626" : "var(--text-primary)" }}>
                  {trumpSuit ? SUIT_SYMBOL[trumpSuit] : "?"}
                </span>
                <span className="text-[0.55rem] text-[var(--text-muted)] uppercase tracking-wide">{t("trump")}</span>
              </div>

              {/* Discard */}
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-xs font-mono font-bold text-[var(--text-muted)]">{room.discardCount}</span>
                <span className="text-[0.55rem] text-[var(--text-muted)] uppercase tracking-wide">{t("discard")}</span>
              </div>

              {/* Pass button (attacker, table not empty) */}
              {isAttackerSide && room.table.length > 0 && !finished && (
                <button onClick={doPass} disabled={busy}
                  className="w-full px-2 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-xs font-display font-bold hover:text-[var(--text-primary)] transition-colors disabled:opacity-40">
                  {t("pass")}
                </button>
              )}
            </div>

            {/* Table slots — drop zone for attack */}
            <div
              ref={onlineTableRef}
              className="flex-1 min-h-[160px] flex flex-wrap items-center justify-center gap-4 py-4 rounded-xl bg-[var(--bg-secondary)]/40 border border-[var(--border-subtle)] transition-colors"
              style={{ borderColor: dragCard && isAttackerSide && room.table.length === 0 ? "var(--accent-orange)" : undefined }}
            onDragOver={(e) => {
              if (dragCard && isAttackerSide && !finished) e.preventDefault();
            }}
            onDrop={async (e) => {
              e.preventDefault();
              try {
                const c = JSON.parse(e.dataTransfer.getData("durak-card")) as Card;
                if (room.table.length === 0) await doAttack(c);
                else await doThrow(c);
              } catch { /* ignore */ }
              setDragCard(null);
            }}
          >
            {room.table.length === 0 ? (
              <p className="text-[var(--text-muted)] text-sm italic">{t("emptyTable")}</p>
            ) : (
              room.table.map((slot, i) => {
                const isSlotDragOver = dragOverSlot === i;
                const isDefendTarget = isDefender && !slot.defense && (selected || dragCard) && !finished;
                return (
                  <div
                    key={i}
                    className={[
                      "relative rounded-xl transition-all",
                      isSlotDragOver ? "ring-2 ring-emerald-400 bg-emerald-500/10" : "",
                    ].join(" ")}
                    style={{ width: 70, height: 116 }}
                    onClick={() => isDefendTarget && selected && doDefend(i)}
                    onDragOver={(e) => {
                      if (dragCard && isDefendTarget) {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverSlot(i);
                      }
                    }}
                    onDragLeave={() => setDragOverSlot(null)}
                    onDrop={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverSlot(null);
                      try {
                        const c = JSON.parse(e.dataTransfer.getData("durak-card")) as Card;
                        await doDefend(i, c);
                      } catch { /* ignore */ }
                      setDragCard(null);
                    }}
                  >
                    <DurakCard
                      card={slot.attack}
                      size="md"
                      style={{ position: "absolute", top: 0, left: 0 }}
                      className={isDefendTarget && !isSlotDragOver ? "ring-2 ring-emerald-400 rounded-lg cursor-pointer" : ""}
                    />
                    {slot.defense && (
                      <DurakCard card={slot.defense} size="md" style={{ position: "absolute", top: 16, left: 12 }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
          </div>{/* end flex row: deck + table */}

          {/* Result banner */}
          {finished && (
            <div className="mb-3 px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-center">
              {durakPlayer ? (
                <p className="font-display font-bold text-[var(--text-primary)]">
                  {iAmDurak ? "😩 " : "🎉 "}
                  {t("durakIs", { name: durakPlayer.name ?? "?" })}
                </p>
              ) : (
                <p className="font-display font-bold text-[var(--text-primary)]">{t("gameOver")}</p>
              )}
              {me?.eloDelta != null && (
                <p className={`text-sm font-bold mt-1 ${me.eloDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {me.eloDelta >= 0 ? "+" : ""}
                  {me.eloDelta} ELO
                </p>
              )}
              <Link href="/games/durak/online" className="inline-block mt-2 text-[var(--accent-orange)] text-sm font-bold">
                {t("backToLobby")} →
              </Link>
            </div>
          )}

          {/* Action bar */}
          {isPlayer && !finished && (
            <div className="flex flex-col gap-2 items-center">
              {/* Contextual hint */}
              {(() => {
                if (isAttackerSide && room.table.length === 0)
                  return <p className="text-sm font-bold text-[var(--accent-orange)] bg-[var(--accent-orange)]/10 border border-[var(--accent-orange)]/30 px-4 py-2 rounded-xl w-full text-center">🗡 {t("youAttackHint")}</p>;
                if (isAttackerSide && room.table.length > 0)
                  return <p className="text-sm font-bold text-[var(--accent-orange)] bg-[var(--accent-orange)]/10 border border-[var(--accent-orange)]/30 px-4 py-2 rounded-xl w-full text-center">🗡 {t("youAttackMoreHint")}</p>;
                if (isDefender && !selected)
                  return <p className="text-sm font-bold text-blue-400 bg-blue-500/10 border border-blue-500/30 px-4 py-2 rounded-xl w-full text-center">🛡 {t("youDefendPickSlot")}</p>;
                if (isDefender && selected)
                  return <p className="text-sm font-bold text-blue-400 bg-blue-500/10 border border-blue-500/30 px-4 py-2 rounded-xl w-full text-center">🛡 {t("youDefendPickCard")}</p>;
                return null;
              })()}

            <div className="flex flex-wrap items-center gap-2 justify-center">
              {isAttackerSide && room.table.length === 0 && (
                <button onClick={() => doAttack()} disabled={!selected || busy} className={actBtn("orange")}>
                  🗡 {t("attack")}
                </button>
              )}
              {isAttackerSide && room.table.length > 0 && (
                <button onClick={() => doThrow()} disabled={!selected || busy} className={actBtn("orange")}>
                  {t("throwIn")}
                </button>
              )}
              {isDefender && (
                <>
                  {room.variant === "perevodnoy" && (
                    <button onClick={doTransfer} disabled={!selected || busy} className={actBtn("indigo")}>
                      {t("transfer")}
                    </button>
                  )}
                  <button onClick={doTake} disabled={busy} className={actBtn("red")}>
                    <Hand size={14} className="inline mr-1" />
                    😮 {t("take")}
                  </button>
                </>
              )}

              {/* Resign */}
              {isPlayer && !finished && (
                <button
                  onClick={() => { if (confirm("Concede the game?")) post("move", { action: "resign" }); }}
                  disabled={busy}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-red-500/40 hover:text-red-400 text-xs font-display font-semibold transition-colors disabled:opacity-40"
                  title="Resign"
                >
                  🏳 Resign
                </button>
              )}

              {/* Cheat buttons (unfair only) */}
              {!room.fairPlay && (
                <div className="flex items-center gap-2 ml-2 pl-2 border-l border-[var(--border-subtle)]">
                  <button onClick={() => post("cheat", { type: "peek" })} disabled={busy} className={actBtn("ghost")} title={t("peek")}>
                    👁 {t("peek")}
                  </button>
                  <button onClick={() => post("cheat", { type: "extra_draw" })} disabled={busy} className={actBtn("ghost")} title={t("extraDraw")}>
                    🃏 {t("extraDraw")}
                  </button>
                </div>
              )}
            </div>
            </div>
          )}

          {err && <p className="text-red-400 text-xs text-center mt-2">{err}</p>}

          {/* My hand */}
          {isPlayer && (
            <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-[0.7rem] text-[var(--text-muted)]">
                  {t("yourHand")} ({isDealDone ? room.myHand.length : "?"})
                </span>
                {room.mySeatIdx === room.attackerIdx && <span className="text-[0.65rem] text-orange-400 font-bold">[{t("youAttack")}]</span>}
                {isDefender && <span className="text-[0.65rem] text-red-400 font-bold">[{t("youDefend")}]</span>}
                {room.timeControl !== "none" && (isAttackerSide || isDefender) && !finished && (
                  <MoveTimer
                    lastMoveAt={room.lastMoveAt}
                    timeLimitSec={Number(room.timeControl)}
                    isMyTurn
                  />
                )}
              </div>
              {/* Scrollable hand — pt-4 gives room for hover translate-y */}
              <div ref={onlineMyHandRef} className="overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: "touch", paddingTop: 16 }}>
                <div style={{ display: "flex", gap: 5, padding: "0 2px", width: "max-content" }}>
                  {room.myHand.map((card, i) => {
                    const key = `${card.suit}-${card.rank}-${i}`;
                    const sortedSeats = [...room.players].sort((a, b) => a.seatIdx - b.seatIdx);
                    const myPos = sortedSeats.findIndex(p => p.userId === myId);
                    const di = i * room.players.length + Math.max(0, myPos);
                    const cardVisible = dealStep > di;
                    const playable = cardIsPlayable(card);
                    const isShaking = shakeCardKey === `${card.suit}-${card.rank}`;
                    return (
                      <div key={key}
                        className={[cardVisible && dealStep <= di + 1 ? "durak-card-in" : "", isShaking ? "animate-bounce" : ""].join(" ")}
                        style={{ opacity: cardVisible ? 1 : 0, flexShrink: 0, transition: "transform 0.15s ease" }}>
                        <DurakCard card={card} size="md"
                          selected={!!selected && cardsEqual(selected, card)}
                          dimmed={!playable && isPlayer && !finished}
                          onClick={() => { if (!playable && isPlayer && !finished) shakeCard(`${card.suit}-${card.rank}`); onCardClick(card); }}
                          draggable={!finished && cardVisible}
                          onDragStart={(e) => { e.dataTransfer.setData("durak-card", JSON.stringify(card)); setDragCard(card); setSelected(card); }}
                          onDragEnd={() => setDragCard(null)}
                          className={["hover:-translate-y-3 transition-transform", playable && isPlayer ? "ring-2 ring-[var(--accent-orange)]/60" : ""].join(" ")} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="flex flex-col gap-2">

        {/* Info panel */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-2.5 text-[0.65rem] text-[var(--text-secondary)] flex flex-col gap-1">
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">{t("variant")}</span>
            <span className="font-semibold">{t(room.variant === "perevodnoy" ? "perevodnoy" : "podkidnoy")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">{t("phaseLabel")}</span>
            <span className="font-semibold">{t(`phase_${room.phase}`)}</span>
          </div>
          {room.timeControl !== "none" && (
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">{t("timePerMove")}</span>
              <span className="font-semibold">{room.timeControl}s</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">{t("deck")}</span>
            <span className={["font-semibold tabular-nums", room.deckCount === 0 ? "text-[var(--text-muted)]" : room.deckCount < 6 ? "text-red-400" : room.deckCount < 16 ? "text-yellow-400" : "text-emerald-400"].join(" ")}>
              {room.deckCount}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">{t("discard")}</span>
            <span className="font-semibold tabular-nums">{room.discardCount}</span>
          </div>
          {room.throwRule !== "all" && (
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">{t("throwRule")}</span>
              <span className="font-semibold">{t("throwNeighbors")}</span>
            </div>
          )}
          {room.rated && (
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">{t("rated")}</span>
              <span className="text-yellow-400 font-bold">⭐</span>
            </div>
          )}
        </div>

        {/* Log */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl flex flex-col overflow-hidden flex-1 relative">
          <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
            <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--text-muted)]">{t("log")} {moves.length > 0 && <span className="opacity-50 normal-case">({moves.length})</span>}</span>
          </div>

          {/* Card preview popup */}
          {previewMove && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[var(--bg-primary)]/80 backdrop-blur-sm rounded-xl"
              onClick={() => setPreviewMove(null)}>
              <p className="text-[0.65rem] text-[var(--text-muted)] mb-2 font-semibold">
                {previewMove.name} — {({ attack: t("botAttacks"), defend: t("botDefends"), throw: t("botThrows"), transfer: t("botTransfers"), take: t("botTakes"), pass: t("botPasses") } as Record<string, string>)[previewMove.action] ?? previewMove.action}
              </p>
              {previewMove.card ? (
                <DurakCard card={previewMove.card as import("@/lib/durak").Card} size="md" />
              ) : (
                <p className="text-2xl">—</p>
              )}
              <p className="text-[0.55rem] text-[var(--text-muted)] mt-2 opacity-60">tap to close</p>
            </div>
          )}

          <div ref={logRef} className="flex flex-col gap-0.5 p-2 overflow-y-auto flex-1 min-h-[120px] max-h-[400px] text-[0.6rem] text-[var(--text-muted)]">
            {moves.length === 0 && (
              <p className="text-center opacity-40 py-4">{t("emptyTable")}</p>
            )}
            {moves.map((m: MoveRecord, i: number) => {
              const p = room.players.find(pl => pl.seatIdx === m.seatIdx);
              const name = p?.name ?? `#${m.seatIdx}`;
              const SUIT_SYM: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
              const cardStr = m.card ? ` ${m.card.rank}${SUIT_SYM[m.card.suit] ?? ""}` : "";
              return (
                <button
                  key={i}
                  onClick={() => setPreviewMove({ action: m.action, card: m.card, name })}
                  className="text-left px-1.5 py-0.5 rounded hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  <span className="opacity-40 mr-1">{m.seq}.</span>
                  <span className="font-semibold">{name}</span>
                  {" "}{({ attack: t("botAttacks"), defend: t("botDefends"), throw: t("botThrows"), transfer: t("botTransfers"), take: t("botTakes"), pass: t("botPasses") } as Record<string, string>)[m.action] ?? m.action}{cardStr}
                </button>
              );
            })}
          </div>
        </div>
        </div>{/* end sidebar flex-col */}
      </div>{/* end grid */}

      {/* ── Chat below everything ── */}
      <div className="mt-3">
        <GameChat msgs={room.chat} myUserId={myId} roomId={roomId} apiBase={API} />
      </div>
    </main>
    </>
  );
}

function actBtn(variant: "orange" | "red" | "indigo" | "muted" | "ghost"): string {
  const base = "px-4 py-2 rounded-xl font-display font-bold text-sm transition-opacity disabled:opacity-40";
  const map: Record<string, string> = {
    orange: "bg-[var(--accent-orange)] text-white hover:opacity-90",
    red: "bg-red-500 text-white hover:opacity-90",
    indigo: "bg-indigo-500 text-white hover:opacity-90",
    muted: "bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
    ghost: "bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 text-xs px-3 py-1.5",
  };
  return `${base} ${map[variant]}`;
}
