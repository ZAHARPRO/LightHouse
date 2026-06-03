"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Eye, Crown, ShieldAlert, Hand, Check, X, Play, Bot, Plus, Trash2 } from "lucide-react";
import DurakCard from "@/components/DurakCard";
import GameChat, { type ChatMsg } from "@/components/GameChat";
import ConnectionBadge, { type ConnStatus } from "@/components/ConnectionBadge";
import type { Card, TableSlot } from "@/lib/durak";
import { SUIT_SYMBOL, SUIT_IS_RED, cardsEqual } from "@/lib/durak";

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
};

type RoomData = {
  id: string;
  status: string;
  variant: string;
  deckSize: number;
  maxPlayers: number;
  timeControl: string;
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
};

const API = "/api/durak-rooms";

export default function DurakRoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;
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
        return false;
      }
      await fetchRoom();
      return true;
    } catch {
      setErr("Network error");
      return false;
    } finally {
      setBusy(false);
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
        <p className="text-[var(--text-muted)] text-sm mb-6">
          {t(room.variant === "perevodnoy" ? "perevodnoy" : "podkidnoy")} · {room.deckSize} · {room.maxPlayers} {t("playersLabel")} ·{" "}
          {room.fairPlay ? t("fairPlay") : t("unfairPlay")}
          {room.rated && <> · ⭐ {t("rated")}</>}
        </p>

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

  return (
    <main className="max-w-5xl mx-auto px-3 py-6">
      <div className="flex items-center justify-between mb-3">
        <Link href="/games/durak/online" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-sm">
          ← {t("backToLobby")}
        </Link>
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        {/* ── Table area ── */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-4 flex flex-col">
          {/* Opponents */}
          <div className="flex flex-wrap items-start justify-center gap-4 mb-4">
            {others.map((p) => {
              const isAtk = p.seatIdx === room.attackerIdx;
              const isDef = p.seatIdx === room.defenderIdx;
              return (
                <div key={p.userId} className={`flex flex-col items-center gap-1 ${p.isOut ? "opacity-40" : ""}`}>
                  <div className="flex items-center gap-1.5">
                    {p.isBot ? (
                      <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                        <Bot size={14} className="text-purple-400" />
                      </div>
                    ) : p.image ? (
                      <Image src={p.image} alt="" width={28} height={28} className="rounded-full" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-[0.6rem]">
                        {p.name?.[0] ?? "?"}
                      </div>
                    )}
                    <span className="text-xs font-display font-semibold text-[var(--text-primary)] max-w-[80px] truncate">{p.name ?? "?"}</span>
                  </div>
                  <div className="flex -space-x-3">
                    {Array.from({ length: Math.min(p.cardCount, 8) }).map((_, i) => (
                      <DurakCard key={i} faceDown size="sm" />
                    ))}
                  </div>
                  <div className="flex items-center gap-1 text-[0.6rem]">
                    <span className="text-[var(--text-muted)]">{p.cardCount} 🂠</span>
                    {isAtk && <span className="text-orange-400 font-bold">{t("attacker")}</span>}
                    {isDef && <span className="text-red-400 font-bold">{t("defender")}</span>}
                    {p.isOut && <span className="text-emerald-400 font-bold">{t("done")}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Deck + trump + discard */}
          <div className="flex items-center justify-center gap-6 mb-4">
            <div className="flex flex-col items-center gap-1">
              <div className="relative" style={{ width: 56, height: 80 }}>
                {room.trumpCard && (
                  <DurakCard
                    card={room.trumpCard}
                    size="md"
                    style={{ position: "absolute", left: 14, top: 8, transform: "rotate(90deg)" }}
                  />
                )}
                {room.deckCount > 0 && <DurakCard faceDown size="md" style={{ position: "absolute", left: 0, top: 0 }} />}
              </div>
              <span className="text-[0.65rem] text-[var(--text-muted)]">
                {t("deck")}: {room.deckCount}
              </span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div
                className="rounded-lg flex items-center justify-center"
                style={{
                  width: 56,
                  height: 80,
                  border: "2px dashed var(--border-subtle)",
                  color: trumpSuit && SUIT_IS_RED[trumpSuit] ? "#dc2626" : "var(--text-secondary)",
                }}
              >
                <span className="text-3xl">{trumpSuit ? SUIT_SYMBOL[trumpSuit] : "?"}</span>
              </div>
              <span className="text-[0.65rem] text-[var(--text-muted)]">{t("trump")}</span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div
                className="rounded-lg flex items-center justify-center text-[var(--text-muted)] text-sm"
                style={{ width: 56, height: 80, background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)" }}
              >
                {room.discardCount}
              </div>
              <span className="text-[0.65rem] text-[var(--text-muted)]">{t("discard")}</span>
            </div>
          </div>

          {/* Table slots — drop zone for attack */}
          <div
            className="flex-1 min-h-[140px] flex flex-wrap items-center justify-center gap-4 py-4 rounded-xl bg-[var(--bg-secondary)]/40 border border-[var(--border-subtle)] mb-4 transition-colors"
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
            <div className="flex flex-wrap items-center gap-2 justify-center">
              {isAttackerSide && room.table.length === 0 && (
                <button onClick={doAttack} disabled={!selected || busy} className={actBtn("orange")}>
                  {t("attack")}
                </button>
              )}
              {isAttackerSide && room.table.length > 0 && (
                <>
                  <button onClick={doThrow} disabled={!selected || busy} className={actBtn("orange")}>
                    {t("throwIn")}
                  </button>
                  <button onClick={doPass} disabled={busy} className={actBtn("muted")}>
                    {t("pass")}
                  </button>
                </>
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
                    {t("take")}
                  </button>
                  <span className="text-[0.7rem] text-[var(--text-muted)]">{t("defendHint")}</span>
                </>
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
          )}

          {err && <p className="text-red-400 text-xs text-center mt-2">{err}</p>}

          {/* My hand */}
          {isPlayer && (
            <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-[0.7rem] text-[var(--text-muted)]">
                  {t("yourHand")} ({room.myHand.length})
                </span>
                {room.mySeatIdx === room.attackerIdx && <span className="text-[0.65rem] text-orange-400 font-bold">{t("youAttack")}</span>}
                {isDefender && <span className="text-[0.65rem] text-red-400 font-bold">{t("youDefend")}</span>}
              </div>
              <div className="flex flex-wrap items-end justify-center gap-2">
                {room.myHand.map((card, i) => (
                  <DurakCard
                    key={`${card.suit}-${card.rank}-${i}`}
                    card={card}
                    size="lg"
                    selected={!!selected && cardsEqual(selected, card)}
                    onClick={() => onCardClick(card)}
                    draggable={!finished}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("durak-card", JSON.stringify(card));
                      setDragCard(card);
                      setSelected(card);
                    }}
                    onDragEnd={() => setDragCard(null)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="flex flex-col gap-3">
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-3 text-xs text-[var(--text-secondary)] flex flex-col gap-1">
            <p>
              <span className="text-[var(--text-muted)]">{t("variant")}:</span>{" "}
              {t(room.variant === "perevodnoy" ? "perevodnoy" : "podkidnoy")}
            </p>
            <p>
              <span className="text-[var(--text-muted)]">{t("phaseLabel")}:</span> {t(`phase_${room.phase}`)}
            </p>
            {room.timeControl !== "none" && (
              <p>
                <span className="text-[var(--text-muted)]">{t("timePerMove")}:</span> {room.timeControl}s
              </p>
            )}
          </div>
          <GameChat msgs={room.chat} myUserId={myId} roomId={roomId} apiBase={API} />
        </div>
      </div>
    </main>
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
