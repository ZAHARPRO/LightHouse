// Shared helper: deal cards and transition a WAITING DurakRoom to PLAYING.
// Used by both the host-start route (casual) and the rated confirm route (matchmaking).

import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/durak-sse";
import { processBotTurns } from "@/lib/durak-engine";
import { createDeck, dealCards, findFirstAttacker, nextActive, type Suit } from "@/lib/durak";

type PlayerSlot = {
  id: string;
  userId: string;
  seatIdx: number;
};

export async function startDurakGame(
  roomId: string,
  room: {
    maxPlayers: number;
    deckSize: number;
    timeControl: string;
    botsJson: string;
  },
  players: PlayerSlot[],
): Promise<void> {
  const bots: { seatIdx: number; difficulty: string; handJson: string; isOut: boolean }[] =
    (() => { try { return JSON.parse(room.botsJson ?? "[]"); } catch { return []; } })();

  const deck = createDeck(room.deckSize as 36 | 52);

  const allSeats = [
    ...players.map((p) => ({ seatIdx: p.seatIdx, isBot: false as const, id: p.id })),
    ...bots.map((b) => ({ seatIdx: b.seatIdx, isBot: true as const, difficulty: b.difficulty })),
  ].sort((a, b) => a.seatIdx - b.seatIdx);

  const { hands, remaining } = dealCards(deck, allSeats.length);
  const trumpCard = remaining[remaining.length - 1] ?? null;
  const trumpSuit: Suit = (trumpCard?.suit ?? "S") as Suit;

  const seatHands: Record<number, (typeof hands)[number]> = {};
  allSeats.forEach((seat, i) => (seatHands[seat.seatIdx] = hands[i]));

  const denseHands = Array.from({ length: room.maxPlayers }, (_, s) => seatHands[s] ?? []);
  const firstAttacker = findFirstAttacker(denseHands, trumpSuit);

  const occupied = new Set(allSeats.map((s) => s.seatIdx));
  const outSet = new Set<number>();
  for (let i = 0; i < room.maxPlayers; i++) if (!occupied.has(i)) outSet.add(i);

  const attackerIdx = occupied.has(firstAttacker)
    ? firstAttacker
    : nextActive(firstAttacker, room.maxPlayers, outSet);
  const defenderIdx = nextActive(attackerIdx, room.maxPlayers, outSet);

  const perMove = room.timeControl === "none" ? null : parseInt(room.timeControl, 10) * 1000;

  const updatedBots = bots.map((b) => ({
    ...b,
    handJson: JSON.stringify(seatHands[b.seatIdx] ?? []),
    isOut: false,
  }));

  const ordered = [...players].sort((a, b) => a.seatIdx - b.seatIdx);

  await prisma.$transaction([
    ...ordered.map((p) =>
      prisma.durakPlayerSlot.update({
        where: { id: p.id },
        data: { handJson: JSON.stringify(seatHands[p.seatIdx] ?? []), timeMs: perMove, isOut: false },
      }),
    ),
    prisma.durakRoom.update({
      where: { id: roomId },
      data: {
        status: "PLAYING",
        deckJson: JSON.stringify(remaining),
        tableJson: "[]",
        discardCount: 0,
        trumpCard: trumpCard ? JSON.stringify(trumpCard) : null,
        trumpSuit,
        attackerIdx,
        defenderIdx,
        phase: "attack",
        lastMoveAt: new Date(),
        startedAt: new Date(),
        pendingCheatJson: null,
        winner: null,
        botsJson: JSON.stringify(updatedBots),
        confirmingAt: null,
        confirmedSeats: "[]",
      },
    }),
  ]);

  broadcast(roomId, { type: "update" });
  void processBotTurns(roomId);
}
