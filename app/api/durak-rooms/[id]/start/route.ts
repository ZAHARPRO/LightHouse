import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/durak-sse";
import { processBotTurns } from "@/lib/durak-engine";
import {
  createDeck,
  dealCards,
  findFirstAttacker,
  nextActive,
  type Suit,
} from "@/lib/durak";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const room = await prisma.durakRoom.findUnique({
    where: { id },
    include: { players: { orderBy: { seatIdx: "asc" } } },
  });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (room.hostId !== session.user.id) return NextResponse.json({ error: "Not host" }, { status: 403 });
  if (room.status !== "WAITING") return NextResponse.json({ error: "Already started" }, { status: 400 });
  const bots: { seatIdx: number; difficulty: string; handJson: string; isOut: boolean }[] =
    (() => { try { return JSON.parse(room.botsJson ?? "[]"); } catch { return []; } })();
  const totalPlayers = room.players.length + bots.length;
  if (totalPlayers < 2) return NextResponse.json({ error: "Need 2+ players" }, { status: 400 });
  if (!room.players.every((p) => p.isReady || p.userId === room.hostId)) {
    return NextResponse.json({ error: "Not everyone ready" }, { status: 400 });
  }

  // Deal to all seats (real players + bots), ordered by seatIdx.
  const deck = createDeck(room.deckSize as 36 | 52);
  const allSeats = [
    ...room.players.map((p) => ({ seatIdx: p.seatIdx, isBot: false as const, id: p.id })),
    ...bots.map((b) => ({ seatIdx: b.seatIdx, isBot: true as const, difficulty: b.difficulty })),
  ].sort((a, b) => a.seatIdx - b.seatIdx);
  const ordered = [...room.players].sort((a, b) => a.seatIdx - b.seatIdx);
  const { hands, remaining } = dealCards(deck, allSeats.length);

  // The trump is the bottom card of the remaining deck (drawn last).
  const trumpCard = remaining[remaining.length - 1] ?? null;
  const trumpSuit: Suit = (trumpCard?.suit ?? "S") as Suit;

  // Seat-indexed hands for first-attacker computation.
  const seatHands: Record<number, typeof hands[number]> = {};
  allSeats.forEach((seat, i) => (seatHands[seat.seatIdx] = hands[i]));

  // Build a dense hands array over maxPlayers seats for findFirstAttacker.
  const denseHands = Array.from({ length: room.maxPlayers }, (_, s) => seatHands[s] ?? []);
  const firstAttacker = findFirstAttacker(denseHands, trumpSuit);
  // Ensure the attacker seat is occupied; otherwise fall back to first seat.
  const occupied = new Set(allSeats.map((s) => s.seatIdx));
  const outSet = new Set<number>();
  for (let i = 0; i < room.maxPlayers; i++) if (!occupied.has(i)) outSet.add(i);
  const attackerIdx = occupied.has(firstAttacker)
    ? firstAttacker
    : nextActive(firstAttacker, room.maxPlayers, outSet);
  const defenderIdx = nextActive(attackerIdx, room.maxPlayers, outSet);

  const perMove = room.timeControl === "none" ? null : parseInt(room.timeControl, 10) * 1000;

  // Updated bots JSON with dealt hands
  const updatedBots = bots.map((b) => ({
    ...b,
    handJson: JSON.stringify(seatHands[b.seatIdx] ?? []),
    isOut: false,
  }));

  await prisma.$transaction([
    ...ordered.map((p) =>
      prisma.durakPlayerSlot.update({
        where: { id: p.id },
        data: { handJson: JSON.stringify(seatHands[p.seatIdx] ?? []), timeMs: perMove, isOut: false },
      }),
    ),
    prisma.durakRoom.update({
      where: { id },
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
      },
    }),
  ]);

  // Broadcast immediately so clients see the PLAYING state (dealing animation fires)
  broadcast(id, { type: "update" });
  // Bots act in background with per-turn delays — fire-and-forget
  void processBotTurns(id);
  return NextResponse.json({ ok: true });
}
