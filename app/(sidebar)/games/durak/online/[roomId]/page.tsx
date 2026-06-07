"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Eye, Crown, Hand, Check, X, Play, Bot, Plus, Trash2, Copy, Settings } from "lucide-react";
import DurakCard from "@/components/DurakCard";
import GameChat, { type ChatMsg } from "@/components/GameChat";
import ConnectionBadge, { type ConnStatus } from "@/components/ConnectionBadge";
import DurakAdPanel, { type AdMode } from "@/components/DurakAdPanel";
import type { Card, TableSlot } from "@/lib/durak";
import { SUIT_SYMBOL, SUIT_IS_RED, cardsEqual, canTransfer } from "@/lib/durak";
import type { MoveRecord } from "@/lib/durak-engine";
import { playSound } from "@/lib/gameSounds";

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
  const W = 76, H = 109;
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
  pendingCheat: { cheaterIdx: number; slotIdx: number } | null;
  winner: string | null;
  chat: ChatMsg[];
  spectatorCount: number;
  botsJson: string;
  movesJson: string;
  lastMoveAt: string | null;
  confirmingAt: string | null;
  confirmedSeats: string;
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
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [previewMove, setPreviewMove] = useState<{ action: string; card?: { suit: string; rank: string }; name: string } | null>(null);
  const [confirmCountdown, setConfirmCountdown] = useState(20);
  const [confirming, setConfirming] = useState(false); // busy state for accept/decline button
  const wasPlayerRef = useRef(false); // detect ejection from confirming room

  // Hand UI state (persisted in localStorage)
  const [handAutoSort, setHandAutoSort] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("durak_hand_autosort") === "1" : false
  );
  const [handOrientation, setHandOrientation] = useState<"left" | "right">(() =>
    typeof window !== "undefined" ? (localStorage.getItem("durak_hand_orientation") as "left" | "right") || "left" : "left"
  );
  const [showHandSettings, setShowHandSettings] = useState(false);
  // Local drag-to-reorder state
  const [localHandOrder, setLocalHandOrder] = useState<Card[]>([]);
  const [insertBeforeIdx, setInsertBeforeIdx] = useState<number | null>(null);

  // Gold coins + ad panel state
  const [myCoins, setMyCoins] = useState<number | null>(null);
  const [adPanel, setAdPanel] = useState<{ mode: AdMode } | null>(null);
  const [discardPile, setDiscardPile] = useState<import("@/lib/durak").Card[] | null>(null);
  const [discardTimer, setDiscardTimer] = useState(0);
  const discardTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
  const autoJoinedRef = useRef(false);

  const fetchRoom = useCallback(async () => {
    try {
      const res = await fetch(`${API}/${roomId}`, { cache: "no-store" });
      if (res.ok) {
        const d = (await res.json()) as RoomData;
        setRoom(d);
        setConn("ok");
        lastFetch.current = Date.now();
      } else if (res.status === 404) {
        setErr(t("roomNotFound"));
      }
    } catch {
      setConn("lost");
    }
  }, [roomId, t]);

  // Auto-join when arriving via invite link
  useEffect(() => {
    if (!room || room.myRole !== "spectator" || room.status !== "WAITING") return;
    if (room.players.length >= room.maxPlayers) return;
    if (autoJoinedRef.current) return;
    autoJoinedRef.current = true;
    fetch(`${API}/${roomId}/join`, { method: "POST" }).then(() => fetchRoom()).catch(() => {});
  }, [room?.myRole, room?.status, room?.players?.length]); // eslint-disable-line

  // SSE + fallback poll
  useEffect(() => {
    fetchRoom();
    const es = new EventSource(`${API}/${roomId}/sse`);
    esRef.current = es;
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as { type: string; cheaterName?: string };
        if (ev.type === "update") fetchRoom();
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
  const dealFiredRef     = useRef(false); // guard against StrictMode double-invoke
  const [onlineFlyCards, setOnlineFlyCards] = useState<{ id: number; from: {x:number;y:number}; to: {x:number;y:number} }[]>([]);
  const prevTableLenRef  = useRef(0);
  const isDealDone       = dealStep >= 999 || (room ? dealStep >= room.players.length * 6 : true);

  // Dealing animation: fires when room transitions WAITING → PLAYING
  useEffect(() => {
    if (!room) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = room.status;
    if (prev === "WAITING" && room.status === "PLAYING") {
      if (dealFiredRef.current) return; // guard against StrictMode double-invoke
      dealFiredRef.current = true;
      const sortedPlayers = [...room.players].sort((a, b) => a.seatIdx - b.seatIdx);
      const total = sortedPlayers.length * 6;
      setDealStep(0);
      setOnlineFlyCards([]);
      let step = 0;
      const id = setInterval(() => {
        step++;
        setDealStep(step);
        if (onlineDeckRef.current) {
          const deckRect = onlineDeckRef.current.getBoundingClientRect();
          const from = { x: deckRect.left + deckRect.width / 2, y: deckRect.top + deckRect.height / 2 };
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

  // Confirmation countdown: tick down from 20 s based on server confirmingAt
  useEffect(() => {
    if (!room?.confirmingAt) { setConfirmCountdown(20); return; }
    const end = new Date(room.confirmingAt).getTime() + 20_000;
    const update = () => setConfirmCountdown(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [room?.confirmingAt]);

  // Track ejection from rated confirming room — when we had a slot and now we don't
  useEffect(() => {
    if (!room) return;
    const isNowPlayer = room.myRole === "player";
    if (isNowPlayer) { wasPlayerRef.current = true; return; }
    if (wasPlayerRef.current && room.status === "WAITING" && !room.confirmingAt) {
      // We were ejected (declined or timed out): send back to rated search with flag to restore elapsed
      router.push("/games/durak/online/rated?returning=1");
    }
  }, [room?.myRole, room?.status, room?.confirmingAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch coin balance once on mount
  useEffect(() => {
    fetch("/api/durak-coins")
      .then(r => r.ok ? r.json() : null)
      .then((d: { durakCoins: number } | null) => { if (d) setMyCoins(d.durakCoins); })
      .catch(() => {});
  }, []); // eslint-disable-line

  // Discard-reveal countdown timer
  useEffect(() => {
    if (!discardPile) return;
    setDiscardTimer(10);
    discardTimerRef.current = setInterval(() => {
      setDiscardTimer(prev => {
        if (prev <= 1) {
          clearInterval(discardTimerRef.current!);
          setDiscardPile(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (discardTimerRef.current) clearInterval(discardTimerRef.current); };
  }, [discardPile]); // eslint-disable-line

  // Auto-scroll log to bottom when new moves arrive
  const movesLen = room ? (() => { try { return (JSON.parse(room.movesJson ?? "[]") as unknown[]).length; } catch { return 0; } })() : 0;
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [movesLen]);

  // 5-second timer warning sound — plays once per turn when ≤5s remain
  const warnPlayedRef = useRef(false);
  useEffect(() => {
    if (!room?.lastMoveAt || room.timeControl === "none") return;
    warnPlayedRef.current = false; // reset on new turn
  }, [room?.lastMoveAt]);
  useEffect(() => {
    if (!room?.lastMoveAt || room.timeControl === "none" || room.status !== "PLAYING") return;
    const limitMs = Number(room.timeControl) * 1000;
    const id = setInterval(() => {
      const remaining = limitMs - (Date.now() - new Date(room.lastMoveAt!).getTime());
      if (remaining <= 5000 && remaining > 0 && !warnPlayedRef.current) {
        warnPlayedRef.current = true;
        playSound("dk_time_warning");
      }
    }, 250);
    return () => clearInterval(id);
  }, [room?.lastMoveAt, room?.timeControl, room?.status]);

  // Action sounds — play when opponents make moves (own moves are felt immediately)
  const prevMovesJsonRef = useRef<string>("");
  useEffect(() => {
    if (!room?.movesJson || room.movesJson === prevMovesJsonRef.current) return;
    try {
      const prevLen = prevMovesJsonRef.current
        ? (JSON.parse(prevMovesJsonRef.current) as MoveRecord[]).length
        : 0;
      const curr = JSON.parse(room.movesJson) as MoveRecord[];
      const newMoves = curr.slice(prevLen);
      for (const move of newMoves) {
        if (move.seatIdx !== room.mySeatIdx) {
          const soundMap: Partial<Record<string, import("@/lib/gameSounds").SoundKey>> = {
            attack: "dk_attack", throw: "dk_attack", transfer: "dk_attack",
            defend: "dk_defend",
            take: "dk_take",
            pass: "dk_pass",
          };
          const key = soundMap[move.action];
          if (key) playSound(key);
        }
      }
    } catch {}
    prevMovesJsonRef.current = room.movesJson;
  }, [room?.movesJson]); // eslint-disable-line react-hooks/exhaustive-deps

  // Win / lose sound when game ends
  const endSoundPlayedRef = useRef(false);
  useEffect(() => {
    if (!room || room.status !== "FINISHED" || endSoundPlayedRef.current) return;
    if (room.myRole !== "player") return;
    endSoundPlayedRef.current = true;
    if (room.winner === myId) playSound("dk_lose");
    else playSound("dk_win");
  }, [room?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Global dragend safety net — clears stuck drag state when drop lands outside any valid target
  useEffect(() => {
    const clear = () => { setDragCard(null); setSelected(null); setInsertBeforeIdx(null); };
    document.addEventListener("dragend", clear);
    return () => document.removeEventListener("dragend", clear);
  }, []);

  // Sync local hand order when server hand changes (keep user reorder, add new cards, remove played)
  const myHandKey = room?.myHand ? [...room.myHand].map(c => `${c.suit}${c.rank}`).sort().join(",") : "";
  useEffect(() => {
    if (!room?.myHand) return;
    setLocalHandOrder(prev => {
      const curr = room.myHand;
      const stillHere = prev.filter(c => curr.some(x => cardsEqual(x, c)));
      const added = curr.filter(c => !prev.some(x => cardsEqual(x, c)));
      return [...stillHere, ...added];
    });
  }, [myHandKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Computed display hand: respects local reorder and auto-sort toggle
  const displayHand = useMemo(() => {
    if (!room?.myHand) return [];
    const curr = room.myHand;
    const stillHere = localHandOrder.filter(c => curr.some(x => cardsEqual(x, c)));
    const added = curr.filter(c => !localHandOrder.some(x => cardsEqual(x, c)));
    const merged = [...stillHere, ...added];
    if (handAutoSort && room.trumpSuit) {
      const trumps = merged.filter(c => c.suit === room.trumpSuit);
      const others = merged.filter(c => c.suit !== room.trumpSuit);
      return [...trumps, ...others];
    }
    return merged;
  }, [room?.myHand, localHandOrder, handAutoSort, room?.trumpSuit]); // eslint-disable-line react-hooks/exhaustive-deps

  function reorderHand(droppedCard: Card, insertBefore: number) {
    if (handAutoSort) return; // auto-sort overrides manual order
    setLocalHandOrder(prev => {
      const curr = room?.myHand ?? [];
      const stillHere = prev.filter(c => curr.some(x => cardsEqual(x, c)));
      const added = curr.filter(c => !prev.some(x => cardsEqual(x, c)));
      const merged = [...stillHere, ...added];
      const fromIdx = merged.findIndex(c => cardsEqual(c, droppedCard));
      if (fromIdx < 0) return prev;
      const without = merged.filter((_, i) => i !== fromIdx);
      const insertAt = Math.max(0, Math.min(insertBefore > fromIdx ? insertBefore - 1 : insertBefore, without.length));
      without.splice(insertAt, 0, droppedCard);
      return without;
    });
  }

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

    // ── Rated match confirmation modal ──────────────────────────────────
    const confirmedList: number[] = (() => { try { return JSON.parse(room.confirmedSeats || "[]"); } catch { return []; } })();
    const iHaveConfirmed = me ? confirmedList.includes(me.seatIdx) : false;

    async function handleConfirm(accept: boolean) {
      setConfirming(true);
      try {
        await fetch(`${API}/${roomId}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accept }),
        });
        fetchRoom();
      } finally {
        setConfirming(false);
      }
    }

    if (room.rated && room.confirmingAt) {
      const pct = confirmCountdown / 20;
      const ringColor = pct > 0.5 ? "#22c55e" : pct > 0.25 ? "#f59e0b" : "#ef4444";
      return (
        <main className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-12">
          <div className="w-full max-w-sm bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-6 flex flex-col items-center gap-5 shadow-2xl">
            {/* Ring timer */}
            <div className="relative flex items-center justify-center">
              <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border-subtle)" strokeWidth="5" />
                <circle cx="40" cy="40" r="34" fill="none" stroke={ringColor} strokeWidth="5"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - pct)}`}
                  style={{ transition: "stroke-dashoffset 0.25s linear, stroke 0.25s" }} />
              </svg>
              <span className="absolute font-mono font-extrabold text-xl tabular-nums" style={{ color: ringColor }}>
                {confirmCountdown}
              </span>
            </div>

            <div className="text-center">
              <h2 className="text-xl font-display font-extrabold text-[var(--text-primary)]">{t("matchFound")}</h2>
              <p className="text-[var(--text-muted)] text-sm mt-1">{t("confirmMatchDesc")}</p>
            </div>

            {/* Player list with checkmarks */}
            <div className="w-full flex flex-col gap-2">
              {room.players.map((p) => {
                const accepted = confirmedList.includes(p.seatIdx);
                return (
                  <div key={p.seatIdx} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                    {p.image ? (
                      <Image src={p.image} alt="" width={28} height={28} className="rounded-full shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center text-[var(--accent-orange)] font-bold text-xs shrink-0">
                        {p.name?.[0] ?? "?"}
                      </div>
                    )}
                    <span className="font-display font-semibold text-[var(--text-primary)] text-sm flex-1 truncate">{p.name ?? "?"}</span>
                    {accepted ? (
                      <Check size={16} className="text-emerald-400 shrink-0" />
                    ) : (
                      <Loader2 size={16} className="text-[var(--text-muted)] animate-spin shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action buttons / status */}
            {isPlayer && !iHaveConfirmed && (
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => handleConfirm(false)}
                  disabled={confirming}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-display font-bold text-sm hover:border-red-500/40 hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  <X size={15} /> {t("declineMatch")}
                </button>
                <button
                  onClick={() => handleConfirm(true)}
                  disabled={confirming}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-display font-bold text-sm hover:bg-emerald-400 transition-colors disabled:opacity-50"
                >
                  <Check size={15} /> {t("acceptMatch")}
                </button>
              </div>
            )}
            {isPlayer && iHaveConfirmed && (
              <p className="text-emerald-400 text-sm font-semibold flex items-center gap-1.5">
                <Check size={15} /> {t("youAccepted")} · {t("waitingForOthers")}
              </p>
            )}
            {!isPlayer && (
              <p className="text-[var(--text-muted)] text-sm">{t("spectating")}</p>
            )}
          </div>
        </main>
      );
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
          {isHost && !room.rated && (
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
  async function doTransfer(card?: Card) {
    const c = card ?? selected;
    if (!c) return;
    if (await post("move", { action: "transfer", card: c })) setSelected(null);
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

  const canCatch = !!room.pendingCheat && isPlayer && room.pendingCheat.cheaterIdx !== room.mySeatIdx;

  const isMainAttacker   = room.mySeatIdx === room.attackerIdx;
  // Next defender = next active player in seat order after current defender (same as engine's nextActive)
  const activeSorted = room.players.filter(p => !p.isOut).sort((a, b) => a.seatIdx - b.seatIdx);
  const defPosInActive = activeSorted.findIndex(p => p.seatIdx === room.defenderIdx);
  const nextDefPlayer = activeSorted[(defPosInActive + 1) % Math.max(1, activeSorted.length)];
  const activeCard = selected ?? dragCard;
  const canDoTransfer = isDefender && !finished && !!activeCard && room.variant === "perevodnoy" &&
    canTransfer(activeCard, room.table, "perevodnoy", nextDefPlayer?.cardCount ?? 99);

  const moves: MoveRecord[] = (() => { try { return JSON.parse(room.movesJson ?? "[]"); } catch { return []; } })();
  const lastMove = moves.length > 0 ? moves[moves.length - 1] : null;
  // Show "took" badge only after the bout fully resolved (not while in declaring-take phase)
  const defTookSeat = (lastMove?.action === "take" && room.status === "PLAYING" && room.phase !== "taking") ? lastMove.seatIdx : null;

  // Seats that have passed during the current throwing round (resets on each throw).
  const throwPassedSeats = useMemo(() => {
    if (room.phase !== "throwing") return new Set<number>();
    let lastThrowIdx = -1;
    for (let j = moves.length - 1; j >= 0; j--) {
      if (moves[j].action === "throw") { lastThrowIdx = j; break; }
    }
    const relevant = lastThrowIdx >= 0 ? moves.slice(lastThrowIdx + 1) : moves;
    return new Set(relevant.filter(m => m.action === "pass").map(m => m.seatIdx));
  }, [room.phase, room.movesJson]); // eslint-disable-line react-hooks/exhaustive-deps

  // Already won (finished before game ends) — can leave without resign penalty
  const iAlreadyWon = isPlayer && !!me?.isOut && room.status === "PLAYING";

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
    <main className="max-w-6xl mx-auto px-2 pt-1 pb-2">
      <div className="flex items-center justify-between mb-1">
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


      <div className="grid grid-cols-1 lg:grid-cols-[1fr_160px] gap-2">
        {/* ── Table area ── */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-2 flex flex-col">
          {/* Opponents — single scrollable row */}
          <div ref={onlineOppRef} className="flex items-center justify-center gap-1 mb-1 overflow-x-auto pb-1 [scrollbar-width:none]">
            {others.map((p) => {
              const isAtk = p.seatIdx === room.attackerIdx;
              const isDef = p.seatIdx === room.defenderIdx;
              const sortedSeats = [...room.players].sort((a, b) => a.seatIdx - b.seatIdx);
              const pos = sortedSeats.findIndex(s => s.userId === p.userId);
              return (
                <div
                  key={p.userId}
                  className={[
                    "flex items-center gap-1 px-1 py-0.5 rounded-md border shrink-0 transition-all",
                    p.isOut   ? "opacity-40 bg-[var(--bg-secondary)] border-[var(--border-subtle)]"
                    : isAtk   ? "bg-orange-500/10 border-orange-500/30"
                    : isDef   ? "bg-red-500/10 border-red-500/30"
                    :           "bg-[var(--bg-secondary)] border-[var(--border-subtle)]",
                  ].join(" ")}
                >
                  {/* Avatar */}
                  {p.isBot ? (
                    <div className="w-4 h-4 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                      <Bot size={9} className="text-purple-400" />
                    </div>
                  ) : p.image ? (
                    <Image src={p.image} alt="" width={16} height={16} className="rounded-full shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-[0.5rem] shrink-0">
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
                      {room.phase === "throwing" && throwPassedSeats.has(p.seatIdx) && !p.isOut && (
                        <span className="text-[0.5rem] font-extrabold px-1 rounded bg-slate-500/30 text-slate-300 leading-none py-px">PASS</span>
                      )}
                      {room.phase === "taking" && isDef && (
                        <span className="text-[0.55rem] font-extrabold px-1 rounded bg-red-500/30 text-red-300 leading-none py-px animate-pulse">{t("defenderTaking")}</span>
                      )}
                      {p.seatIdx === defTookSeat && (
                        <span className="text-[0.5rem] font-extrabold px-1 rounded bg-red-500/20 text-red-400 leading-none py-px">{t("defenderTook")}</span>
                      )}
                    </div>

                    {/* Cards + count */}
                    <div className="flex items-center gap-1">
                      <div className="flex -space-x-2">
                        {Array.from({ length: Math.min(p.cardCount, 5) }).map((_, i) => {
                          const di = i * room.players.length + Math.max(0, pos);
                          const cardVisible = isDealDone || dealStep > di;
                          return (
                            <div key={i} className={cardVisible && dealStep <= di + 1 ? "durak-card-in" : ""} style={{ opacity: cardVisible ? 1 : 0 }}>
                              <DurakCard faceDown size="xs" style={{ width: 26, height: 37 }} />
                            </div>
                          );
                        })}
                        {p.cardCount > 5 && <span className="text-[0.6rem] font-bold text-[var(--text-muted)] ml-0.5 self-center">+{p.cardCount - 5}</span>}
                      </div>
                      <span className={[
                        "text-sm font-mono font-extrabold tabular-nums leading-none",
                        !isDealDone ? "opacity-0"
                        : p.cardCount === 0   ? "text-emerald-400"
                        : p.cardCount <= 2    ? "text-red-400"
                        : p.cardCount <= 4    ? "text-yellow-400"
                        : p.cardCount <= 6    ? "text-sky-400"
                        :                       "text-[var(--text-secondary)]"
                      ].join(" ")}>
                        {isDealDone ? p.cardCount : "?"}
                      </span>
                      {room.timeControl !== "none" && !finished && (
                        (room.phase === "attack" && isAtk) ||
                        (room.phase === "defense" && isDef) ||
                        ((room.phase === "throwing" || room.phase === "taking") &&
                          p.seatIdx !== room.defenderIdx && !p.isOut)
                      ) && (
                        <MoveTimer lastMoveAt={room.lastMoveAt} timeLimitSec={Number(room.timeControl)} isMyTurn={false} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Deck + Table in one row */}
          <div className="flex gap-3 mb-2">
            {/* Left column: deck / trump / discard / pass */}
            <div className="flex flex-col items-center gap-2 shrink-0 w-[112px]">
              {/* Deck */}
              <div className="relative" ref={onlineDeckRef} style={{ width: 100, height: 143, overflow: "visible" }}>
                {room.deckCount > 0 ? (
                  <>
                    {/* Trump card peeking sideways — always on top of anything else, clearly visible */}
                    {room.trumpCard && (
                      <DurakCard
                        card={room.trumpCard}
                        size="sm"
                        style={{
                          position: "absolute",
                          left: -34,
                          top: 17,
                          transform: "rotate(90deg)",
                          zIndex: 3,
                        }}
                      />
                    )}
                    <DurakCard faceDown size="md" style={{ position: "absolute", left: 0, top: 0, zIndex: 2 }} />
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
                  <div className="w-[100px] h-[143px] rounded-lg border border-dashed border-[var(--border-subtle)] flex items-center justify-center opacity-30 text-2xl">🂠</div>
                )}
              </div>

              {/* Trump suit */}
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-5xl leading-none"
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

              {/* View discard button */}
              {isPlayer && myCoins !== null && !room.rated && (
                <button
                  onClick={async () => {
                    if (myCoins < 1) { setAdPanel({ mode: "coins" }); return; }
                    const [spendRes, discardRes] = await Promise.all([
                      fetch("/api/durak-coins/spend", { method: "POST" }),
                      fetch(`${API}/${roomId}/discard`),
                    ]);
                    if (spendRes.ok) {
                      const d = await spendRes.json() as { durakCoins: number };
                      setMyCoins(d.durakCoins);
                    }
                    if (discardRes.ok) {
                      const d = await discardRes.json() as { cards: import("@/lib/durak").Card[] };
                      if (d.cards) { setDiscardPile(d.cards); setDiscardTimer(10); }
                    }
                  }}
                  title={myCoins > 0 ? `${t("viewDiscard")} (-1🪙)` : t("watchAdForCoins")}
                  className={[
                    "w-full px-2 py-1.5 rounded-lg border text-xs font-display font-bold transition-colors",
                    myCoins > 0
                      ? "bg-pink-500/10 border-pink-500/30 text-pink-400 hover:bg-pink-500/20"
                      : "bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-50 cursor-not-allowed",
                  ].join(" ")}
                >
                 {t("viewDiscard")}
                </button>
              )}

              {/* Pass button (attacker/thrower, table not empty, all cards defended) */}
              {isAttackerSide && room.table.length > 0 && !finished &&
                (room.phase !== "throwing" || room.table.every((s) => s.defense !== null)) && (
                <button onClick={doPass} disabled={busy}
                  className="w-full px-2 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-xs font-display font-bold hover:text-[var(--text-primary)] transition-colors disabled:opacity-40">
                  {t("pass")}
                </button>
              )}
            </div>

            {/* Table slots — drop zone for attack */}
            <div
              ref={onlineTableRef}
              className="flex-1 min-h-[120px] flex flex-wrap items-center justify-center gap-4 py-2 rounded-xl bg-[var(--bg-secondary)]/40 border border-[var(--border-subtle)] transition-colors"
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
                const isMyAttack = !slot.defense && myCoins !== null && !room.rated && !finished && !busy &&
                  moves.slice().reverse().some(
                    m => m.seatIdx === room.mySeatIdx && (m.action === "attack" || m.action === "throw") && m.card
                      && m.card.suit === slot.attack.suit && m.card.rank === slot.attack.rank
                  );
                const canRecall = isMyAttack && myCoins > 0;
                return (
                  <div
                    key={i}
                    className={[
                      "group relative rounded-xl transition-all",
                      isSlotDragOver ? "ring-2 ring-emerald-400 bg-emerald-500/10" : "",
                    ].join(" ")}
                    style={{ width: 100, height: 163 }}
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
                      className={isDefendTarget && !isSlotDragOver ? "ring-2 ring-emerald-400 rounded-lg cursor-crosshair" : ""}
                    />
                    {slot.defense && (() => {
                      const isCheatSlot = canCatch && room.pendingCheat?.slotIdx === i;
                      return (
                        <DurakCard
                          card={slot.defense}
                          size="md"
                          style={{ position: "absolute", top: 20, left: 16 }}
                          className={isCheatSlot ? "ring-2 ring-red-500 rounded-lg cursor-pointer animate-pulse" : ""}
                          onClick={isCheatSlot ? () => post("catch") : undefined}
                        />
                      );
                    })()}
                    {/* Recall button — appears on hover for the player's own undefended card */}
                    {isMyAttack && (
                      <button
                        onClick={async () => {
                          if (!canRecall) { setAdPanel({ mode: "coins" }); return; }
                          setBusy(true);
                          const res = await fetch(`${API}/${roomId}/recall`, { method: "POST" });
                          setBusy(false);
                          if (res.ok) {
                            const d = await fetch("/api/durak-coins").then(r => r.json()) as { durakCoins: number };
                            setMyCoins(d.durakCoins);
                            fetchRoom();
                          } else {
                            const d = await res.json() as { error?: string };
                            if (d.error === "no_coins") setAdPanel({ mode: "coins" });
                          }
                        }}
                        title={canRecall ? `${t("recall")} (-1🪙)` : t("watchAdForCoins")}
                        className={[
                          "absolute top-1 right-1 z-10 w-6 h-6 rounded-md border text-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all",
                          canRecall
                            ? "bg-[var(--bg-elevated)]/90 border-amber-500/40 text-amber-400 hover:bg-amber-500/20"
                            : "bg-[var(--bg-elevated)]/90 border-[var(--border-subtle)] text-[var(--text-muted)] cursor-not-allowed",
                        ].join(" ")}
                      >
                        ↩
                      </button>
                    )}
                  </div>
                );
              })
            )}
            {/* Transfer affordance — appears to the right when defender can transfer */}
            {canDoTransfer && (
              <button
                onClick={() => doTransfer()}
                disabled={busy}
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => {
                  e.preventDefault();
                  try {
                    const c = JSON.parse(e.dataTransfer.getData("durak-card")) as Card;
                    await doTransfer(c);
                  } catch { /* ignore */ }
                  setDragCard(null);
                }}
                className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-blue-400/70 text-blue-400 hover:bg-blue-500/10 hover:border-blue-400 transition-colors disabled:opacity-40"
                style={{ width: 100, height: 163, flexShrink: 0 }}
              >
                <span className="text-xl leading-none">⇒</span>
                <span className="text-[0.6rem] font-bold">{t("transfer")}</span>
              </button>
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

            <div className="flex flex-wrap items-center gap-2 justify-center">
              {isDefender && room.phase !== "taking" && (
                <button onClick={doTake} disabled={busy} className={actBtn("red")}>
                  <Hand size={14} className="inline mr-1" />
                  😮 {t("take")}
                </button>
              )}
              {isDefender && room.phase === "taking" && (
                <span className="px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 font-display font-extrabold text-sm animate-pulse">
                  😮 {t("defenderTaking")} — {t("waitingForOthers")}
                </span>
              )}

            </div>
            </div>
          )}

          {err && <p className="text-red-400 text-xs text-center mt-2">{err}</p>}

          {/* My hand */}
          {isPlayer && (
            <div className="mt-2 pt-2 border-t border-[var(--border-subtle)]">
              {/* Hand header row */}
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="text-[0.7rem] text-[var(--text-muted)]">
                  {t("yourHand")} ({isDealDone ? room.myHand.length : "?"})
                </span>
                {isMainAttacker && <span className="text-[0.65rem] text-orange-400 font-bold">[{t("youAttack")}]</span>}
                {isDefender && room.phase !== "taking" && <span className="text-[0.65rem] text-red-400 font-bold">[{t("youDefend")}]</span>}
                {isDefender && room.phase === "taking" && <span className="text-[0.65rem] text-red-300 font-bold animate-pulse">[{t("youTaking")}]</span>}
                {room.phase === "throwing" && throwPassedSeats.has(room.mySeatIdx ?? -1) && isAttackerSide && (
                  <span className="text-[0.65rem] font-extrabold px-1 rounded bg-slate-500/30 text-slate-300 leading-none py-px">PASS</span>
                )}
                {room.timeControl !== "none" && !finished && (
                  (room.phase === "attack" && isMainAttacker) ||
                  (room.phase === "defense" && isDefender) ||
                  ((room.phase === "throwing" || room.phase === "taking") && isAttackerSide)
                ) && (
                  <MoveTimer lastMoveAt={room.lastMoveAt} timeLimitSec={Number(room.timeControl)} isMyTurn />
                )}
                {/* Settings gear */}
                <button
                  onClick={() => setShowHandSettings(v => !v)}
                  title={t("handSettings")}
                  className={`p-1 rounded-md transition-colors ${showHandSettings ? "text-[var(--accent-orange)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
                >
                  <Settings size={13} />
                </button>
              </div>

              {/* Hand settings panel */}
              {showHandSettings && (
                <div className="mb-2 px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex flex-wrap items-center gap-4">
                  {/* Auto-sort toggle */}
                  <label className="flex items-center gap-2 text-[0.7rem] text-[var(--text-secondary)] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={handAutoSort}
                      onChange={e => {
                        setHandAutoSort(e.target.checked);
                        localStorage.setItem("durak_hand_autosort", e.target.checked ? "1" : "0");
                      }}
                      className="accent-[var(--accent-orange)] w-3.5 h-3.5 cursor-pointer"
                    />
                    {t("autoSortHand")}
                  </label>
                  {/* Orientation */}
                  <div className="flex items-center gap-1.5 text-[0.7rem]">
                    <span className="text-[var(--text-muted)]">{t("handLayout")}:</span>
                    {(["left", "right"] as const).map(side => (
                      <button
                        key={side}
                        onClick={() => {
                          setHandOrientation(side);
                          localStorage.setItem("durak_hand_orientation", side);
                        }}
                        className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                          handOrientation === side
                            ? "bg-[var(--accent-orange)]/20 text-[var(--accent-orange)]"
                            : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                        }`}
                      >
                        {side === "left" ? `← ${t("layoutLeft")}` : `${t("layoutRight")} →`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Fan hand — adaptive density, selected card pops up, drag-to-reorder */}
              {(() => {
                const count = displayHand.length;
                const fanSpread = Math.min(10, 90 / Math.max(1, count));
                const fanStep   = Math.min(26, 300 / Math.max(1, count));
                // "right" orientation: mirror angles/offsets by negating the sign
                const orientSign = handOrientation === "right" ? -1 : 1;
                const sortedSeats = [...room.players].sort((a, b) => a.seatIdx - b.seatIdx);
                const myPos = sortedSeats.findIndex(p => p.userId === myId);

                return (
                  <div
                    ref={onlineMyHandRef}
                    style={{ position: "relative", height: 155, width: "100%", marginTop: 4, overflow: "visible" }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) setInsertBeforeIdx(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragCard(null); // always clear — prevents stuck semi-transparent card
                      if (insertBeforeIdx === null) return;
                      try {
                        const card = JSON.parse(e.dataTransfer.getData("durak-card")) as Card;
                        reorderHand(card, insertBeforeIdx);
                      } catch { /* ignore */ }
                      setInsertBeforeIdx(null);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    {displayHand.map((card, i) => {
                      const key = `${card.suit}-${card.rank}-${i}`;
                      const di = i * room.players.length + Math.max(0, myPos);
                      const cardVisible = isDealDone || dealStep > di;
                      const isSelected = !!selected && cardsEqual(selected, card);
                      const isDragging = !!dragCard && cardsEqual(dragCard, card);

                      const angle  = orientSign * (i - (count - 1) / 2) * fanSpread;
                      const offset = orientSign * (i - (count - 1) / 2) * fanStep;
                      const liftY  = isSelected ? -18 : 0;

                      // For insert indicator: with right orientation, left/right flip
                      const showInsertLeft  = !handAutoSort && insertBeforeIdx === i && dragCard && !isDragging;
                      const showInsertRight = !handAutoSort && i === count - 1 && insertBeforeIdx === count && dragCard && !isDragging;

                      return (
                        <div
                          key={key}
                          className={cardVisible && dealStep <= di + 1 ? "durak-card-in" : ""}
                          style={{
                            position: "absolute",
                            left: "50%",
                            bottom: 0,
                            transform: `translateX(calc(-50% + ${offset}px)) rotate(${angle}deg) translateY(${liftY}px)`,
                            transformOrigin: "bottom center",
                            transition: "transform 0.15s ease",
                            zIndex: isSelected ? count + 10 : handOrientation === "right" ? count - 1 - i : i,
                            opacity: isDragging ? 0.4 : cardVisible ? 1 : 0,
                            pointerEvents: cardVisible ? "auto" : "none",
                          }}
                          onDragOver={(e) => {
                            if (!dragCard || handAutoSort || !cardVisible) return;
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const mid = rect.left + rect.width / 2;
                            // for right orientation: flip left/right meaning
                            const goLeft = handOrientation === "right" ? e.clientX > mid : e.clientX < mid;
                            setInsertBeforeIdx(goLeft ? i : i + 1);
                          }}
                        >
                          {/* Insert indicator left */}
                          {showInsertLeft && (
                            <div style={{ position: "absolute", left: -4, top: "8%", bottom: "8%", width: 3, borderRadius: 4, background: "#3b82f6", zIndex: 30, pointerEvents: "none" }} />
                          )}
                          {/* Insert indicator right (last card) */}
                          {showInsertRight && (
                            <div style={{ position: "absolute", right: -4, top: "8%", bottom: "8%", width: 3, borderRadius: 4, background: "#3b82f6", zIndex: 30, pointerEvents: "none" }} />
                          )}
                          <DurakCard
                            card={card}
                            size="md"
                            selected={isSelected}
                            draggable={!finished && cardVisible}
                            onDragStart={(e) => { e.dataTransfer.setData("durak-card", JSON.stringify(card)); setDragCard(card); setSelected(card); }}
                            onDragEnd={() => { setDragCard(null); setInsertBeforeIdx(null); setSelected(null); }}
                            className="transition-transform duration-150 hover:-translate-y-3"
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="flex flex-col gap-2">
                        {isPlayer && !finished && iAlreadyWon && (
                <a
                  href={`/games/durak/online`}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 text-xs font-display font-semibold transition-colors"
                >
                  ✓ Leave
                </a>
              )}
              {isPlayer && !finished && !iAlreadyWon && (
                <button
                  onClick={() => { if (confirm("Concede the game?")) post("move", { action: "resign" }); }}
                  disabled={busy}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-red-500/40 hover:text-red-400 text-xs font-display font-semibold transition-colors disabled:opacity-40"
                  title="Resign"
                >
                  🏳 Resign
                </button>
              )}

              {/* Gold coins: badge + earn */}
              {myCoins !== null && isPlayer && !room.rated && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-display font-bold text-amber-400">🪙 {myCoins}</span>
                  {myCoins < 5 && (
                    <button
                      onClick={() => setAdPanel({ mode: "coins" })}
                      title={t("earnCoins")}
                      className="px-2 py-1 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[0.6rem] font-display font-semibold hover:text-amber-400 transition-colors"
                    >
                      + {t("earnCoins")}
                    </button>
                  )}
                </div>
              )}


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

    {/* Ad panel overlay — fixed to the right side over the log area */}
    {adPanel && (
      <DurakAdPanel
        mode={adPanel.mode}
        roomId={roomId}
        side="right"
        onClose={() => setAdPanel(null)}
        onCoinsEarned={(n) => { setMyCoins(n); setAdPanel(null); }}
        onDiscardRevealed={(cards) => { setDiscardPile(cards); setAdPanel(null); }}
      />
    )}

    {/* Discard pile reveal overlay */}
    {discardPile && (
      <div className="fixed right-2 top-1/2 -translate-y-1/2 z-40 w-72 bg-[var(--bg-elevated)] border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border-subtle)] bg-purple-500/5">
          <span className="font-display font-bold text-xs text-[var(--text-primary)]">
            🃏 {t("discardPileTitle")} <span className="text-purple-400">({discardTimer}s)</span>
          </span>
          <button onClick={() => setDiscardPile(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-0.5">
            <X size={14} />
          </button>
        </div>
        <div className="p-3 max-h-64 overflow-y-auto">
          {discardPile.length === 0 ? (
            <p className="text-[var(--text-muted)] text-xs text-center py-2">{t("discardEmpty")}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 justify-center">
              {[...discardPile].reverse().map((card, i) => (
                <DurakCard key={i} card={card} size="xs" />
              ))}
            </div>
          )}
        </div>
      </div>
    )}
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
