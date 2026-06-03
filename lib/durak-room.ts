// Shared helpers for the Durak API routes: client sanitization, ELO finalization.

import { prisma } from "@/lib/prisma";
import { calculateEloDelta } from "@/lib/elo";
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
};

export type ClientRoomData = {
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
  players: ClientPlayerData[];
  myHand: Card[];
  myRole: "player" | "spectator";
  mySeatIdx: number | null;
  pendingCheat: { type: string; cheaterName: string } | null;
  peekedCard: Card | null;
  winner: string | null;
  chat: ChatMsg[];
  spectatorCount: number;
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
  user: { id: string; name: string | null; image: string | null; durakElo: number };
};

type RoomWithSlots = {
  id: string;
  status: string;
  variant: string;
  deckSize: number;
  maxPlayers: number;
  timeControl: string;
  rated: boolean;
  fairPlay: boolean;
  hostId: string;
  deckJson: string;
  tableJson: string;
  discardCount: number;
  trumpCard: string | null;
  trumpSuit: string | null;
  attackerIdx: number;
  defenderIdx: number;
  phase: string;
  pendingCheatJson: string | null;
  winner: string | null;
  chatJson: string;
  spectatorsJson: string;
  players: SlotWithUser[];
};

export const roomInclude = {
  players: {
    orderBy: { seatIdx: "asc" as const },
    include: {
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
  }));

  return {
    id: room.id,
    status: room.status,
    variant: room.variant,
    deckSize: room.deckSize,
    maxPlayers: room.maxPlayers,
    timeControl: room.timeControl,
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
  };
}

/**
 * Finalize a finished rated game: the durak loses ELO against each winner
 * individually; each winner gains. Deltas are summed and persisted per slot.
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
  const winners = room.players.filter((p) => p.seatIdx !== durakSeatIdx);
  if (winners.length === 0) return;

  const durakElo = durakSlot.user.durakElo;
  let durakTotalLoss = 0;

  const updates: Array<Promise<unknown>> = [];

  // Compute each winner's gain vs the durak.
  const winnerDeltas = winners.map((w) => {
    const [delta] = calculateEloDelta(w.user.durakElo, durakElo);
    durakTotalLoss += delta;
    return { slot: w, delta };
  });

  for (const { slot, delta } of winnerDeltas) {
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

  updates.push(
    prisma.user.update({
      where: { id: durakSlot.userId },
      data: { durakElo: Math.max(100, durakElo - durakTotalLoss) },
    }),
  );
  updates.push(
    prisma.durakPlayerSlot.update({
      where: { id: durakSlot.id },
      data: { eloDelta: -durakTotalLoss },
    }),
  );

  await Promise.all(updates);
}
