// Shared helpers for the Durak API routes: client sanitization, ELO finalization.

import { prisma } from "@/lib/prisma";
import { calculateEloDelta } from "@/lib/elo";
import { awardBadge, awardDurakEloBadges } from "@/lib/awardBadge";
import type { Card, TableSlot } from "@/lib/durak";

export type ChatMsg = { userId: string; name: string; text: string; at: number };

export type PendingCheat = {
  type: "peek" | "extra_draw";
  cheaterIdx: number;
  targetIdx: number | null;
  card: Card | null; // the peeked card (only revealed to the cheater)
  expiresAt: number;
};

export type ClientPlayerData = {
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

export type ClientRoomData = {
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
  players: ClientPlayerData[];
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
  lastMoveAt: string | null; // ISO timestamp — client uses it for live countdown
  confirmingAt: string | null; // ISO — set while rated match-confirmation is in progress
  confirmedSeats: string; // JSON seatIdx[]
};

type SlotWithUser = {
  id: string;
  userId: string;
  seatIdx: number;
  handJson: string;
  timeMs: number | null;
  isReady: boolean;
  isOut: boolean;
  eloDelta: number | null;
  finishPosition: number | null;
  user: { id: string; name: string | null; image: string | null; durakElo: number };
};

type RoomWithSlots = {
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
  deckJson: string;
  tableJson: string;
  discardCount: number;
  discardJson: string;
  trumpCard: string | null;
  trumpSuit: string | null;
  attackerIdx: number;
  defenderIdx: number;
  phase: string;
  pendingCheatJson: string | null;
  winner: string | null;
  lastMoveAt: Date | null;
  botsJson: string;
  chatJson: string;
  movesJson: string;
  spectatorsJson: string;
  confirmingAt: Date | null;
  confirmedSeats: string;
  players: SlotWithUser[];
};

export const roomInclude = {
  players: {
    orderBy: { seatIdx: "asc" as const },
    select: {
      id: true,
      userId: true,
      seatIdx: true,
      handJson: true,
      timeMs: true,
      isReady: true,
      isOut: true,
      eloDelta: true,
      finishPosition: true,
      eloSnapshot: true,
      user: { select: { id: true, name: true, image: true, durakElo: true } },
    },
  },
};

function parseJSON<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Build the sanitized client view of a room for `userId` (null = spectator). */
export function sanitizeRoom(room: RoomWithSlots, userId: string | null): ClientRoomData {
  const now = Date.now();
  const slots = [...room.players].sort((a, b) => a.seatIdx - b.seatIdx);
  const mySlot = userId ? slots.find((s) => s.userId === userId) ?? null : null;

  const spectators = parseJSON<{ id: string; at: number }[]>(room.spectatorsJson, []);
  const spectatorCount = spectators.filter((s) => now - s.at < 60_000).length;

  const pending = parseJSON<PendingCheat | null>(room.pendingCheatJson, null);
  const validPending = pending && pending.expiresAt > now ? pending : null;

  let pendingCheat: { type: string; cheaterName: string } | null = null;
  let peekedCard: Card | null = null;
  if (validPending) {
    const cheaterSlot = slots.find((s) => s.seatIdx === validPending.cheaterIdx);
    const cheaterName = cheaterSlot?.user.name ?? "?";
    if (mySlot && mySlot.seatIdx === validPending.cheaterIdx) {
      // The cheater sees their peeked card but not the public alert banner.
      peekedCard = validPending.card;
    } else {
      pendingCheat = { type: validPending.type, cheaterName };
    }
  }

  const players: ClientPlayerData[] = slots.map((s) => ({
    userId: s.userId,
    name: s.user.name,
    image: s.user.image,
    seatIdx: s.seatIdx,
    cardCount: parseJSON<Card[]>(s.handJson, []).length,
    isOut: s.isOut,
    isReady: s.isReady,
    timeMs: s.timeMs,
    elo: s.user.durakElo,
    eloDelta: s.eloDelta,
    isBot: false,
  }));

  // Merge bot virtual players
  type BotEntry = { seatIdx: number; difficulty: string; handJson: string; isOut: boolean };
  const botEntries = parseJSON<BotEntry[]>(room.botsJson, []);
  for (const bot of botEntries) {
    players.push({
      userId: `__bot_${bot.seatIdx}__`,
      name: `Bot (${bot.difficulty})`,
      image: null,
      seatIdx: bot.seatIdx,
      cardCount: parseJSON<Card[]>(bot.handJson, []).length,
      isOut: bot.isOut,
      isReady: true,
      timeMs: null,
      elo: 0,
      eloDelta: null,
      isBot: true,
      botDifficulty: bot.difficulty,
    });
  }
  players.sort((a, b) => a.seatIdx - b.seatIdx);

  return {
    id: room.id,
    status: room.status,
    variant: room.variant,
    deckSize: room.deckSize,
    maxPlayers: room.maxPlayers,
    timeControl: room.timeControl,
    throwRule: room.throwRule,
    rated: room.rated,
    fairPlay: room.fairPlay,
    hostId: room.hostId,
    trumpCard: parseJSON<Card | null>(room.trumpCard, null),
    trumpSuit: room.trumpSuit,
    deckCount: parseJSON<Card[]>(room.deckJson, []).length,
    table: parseJSON<TableSlot[]>(room.tableJson, []),
    discardCount: room.discardCount,
    attackerIdx: room.attackerIdx,
    defenderIdx: room.defenderIdx,
    phase: room.phase,
    players,
    myHand: mySlot ? parseJSON<Card[]>(mySlot.handJson, []) : [],
    myRole: mySlot ? "player" : "spectator",
    mySeatIdx: mySlot ? mySlot.seatIdx : null,
    pendingCheat,
    peekedCard,
    winner: room.winner,
    chat: parseJSON<ChatMsg[]>(room.chatJson, []),
    spectatorCount,
    botsJson: room.botsJson,
    movesJson: room.movesJson,
    lastMoveAt: room.lastMoveAt ? room.lastMoveAt.toISOString() : null,
    confirmingAt: room.confirmingAt ? room.confirmingAt.toISOString() : null,
    confirmedSeats: room.confirmedSeats ?? "[]",
  };
}

/**
 * ELO multipliers by finish position (1st winner = index 0).
 * 1st: 100%, 2nd: 80%, 3rd: 60%, 4th: 40%, 5th: 30%, 6th+: 20%.
 */
const POSITION_MULTIPLIERS = [1.0, 0.8, 0.6, 0.4, 0.3, 0.2];
const BASE_ELO = 50; // base ELO amount for 1st place winner

/**
 * Finalize a finished rated game using position-based ELO.
 *
 * Winners earn BASE_ELO × position_multiplier (1st=50, 2nd=40, 3rd=30…).
 * The Durak (last player) loses BASE_ELO (50).
 * That 50-ELO penalty is split evenly among all non-Durak players as a
 * bonus on top of their position-based gain (floor division, remainder lost).
 *
 * Example (4 players):
 *   1st: +50 (position) + 16 (split of 50÷3) = +66
 *   2nd: +40 + 16 = +56
 *   3rd: +30 + 16 = +46
 *   Durak: −50
 *
 * Idempotent: skips if any slot already has an eloDelta.
 */
export async function finalizeRatedDurak(
  roomId: string,
  durakSeatIdx: number,
): Promise<void> {
  const room = await prisma.durakRoom.findUnique({
    where: { id: roomId },
    include: roomInclude,
  });
  if (!room || !room.rated) return;
  if (room.players.some((p) => p.eloDelta != null)) return; // already applied

  const durakSlot = room.players.find((p) => p.seatIdx === durakSeatIdx);
  if (!durakSlot) return;

  // Sort winners by the order they finished (finishPosition ascending).
  // Players who never formally went out (e.g. opponent resigned) get finishPosition null —
  // treat them as last-place winners so they still receive ELO.
  const winners = room.players
    .filter((p) => p.seatIdx !== durakSeatIdx)
    .sort((a, b) => (a.finishPosition ?? 999) - (b.finishPosition ?? 999));

  // The Durak's 50 ELO penalty is split equally as a bonus to each winner.
  const durakLoss = BASE_ELO;
  const splitBonus = winners.length > 0 ? Math.floor(durakLoss / winners.length) : 0;

  const updates: Array<Promise<unknown>> = [];
  const winnerDeltas: { slot: SlotWithUser; delta: number }[] = [];

  for (const [i, slot] of winners.entries()) {
    const multiplier = POSITION_MULTIPLIERS[i] ?? 0.2;
    const positionGain = Math.round(BASE_ELO * multiplier);
    const delta = positionGain + splitBonus;
    winnerDeltas.push({ slot, delta });
    updates.push(
      prisma.user.update({
        where: { id: slot.userId },
        data: { durakElo: Math.max(100, slot.user.durakElo + delta) },
      }),
    );
    updates.push(
      prisma.durakPlayerSlot.update({ where: { id: slot.id }, data: { eloDelta: delta } }),
    );
  }

  // Durak loses BASE_ELO
  updates.push(
    prisma.user.update({
      where: { id: durakSlot.userId },
      data: { durakElo: Math.max(100, durakSlot.user.durakElo - durakLoss) },
    }),
  );
  updates.push(
    prisma.durakPlayerSlot.update({ where: { id: durakSlot.id }, data: { eloDelta: -durakLoss } }),
  );

  await Promise.all(updates);

  // Badges
  for (const { slot, delta } of winnerDeltas) {
    const newElo = Math.max(100, slot.user.durakElo + delta);
    await awardBadge(prisma, slot.userId, "DURAK_ONLINE_WIN");
    await awardDurakEloBadges(prisma, slot.userId, newElo);
    if (winners.length >= 3) await awardBadge(prisma, slot.userId, "DURAK_NOT_DURAK");
  }
  const newDurakElo = Math.max(100, durakSlot.user.durakElo - durakLoss);
  await awardDurakEloBadges(prisma, durakSlot.userId, newDurakElo);
}
