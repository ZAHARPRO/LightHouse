import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/durak-sse";
import { cardsEqual } from "@/lib/durak";
import type { Card, TableSlot } from "@/lib/durak";
import type { MoveRecord } from "@/lib/durak-engine";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const uid = session.user.id;

  const [room, user] = await Promise.all([
    prisma.durakRoom.findUnique({
      where: { id },
      include: { players: { select: { userId: true, seatIdx: true, handJson: true } } },
    }),
    prisma.user.findUnique({ where: { id: uid }, select: { durakCoins: true } }),
  ]);

  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if (room.status !== "PLAYING") return NextResponse.json({ error: "Game not in progress" }, { status: 400 });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.durakCoins < 1) return NextResponse.json({ error: "no_coins" }, { status: 400 });

  const mySlot = room.players.find((p) => p.userId === uid);
  if (!mySlot) return NextResponse.json({ error: "Not a player" }, { status: 403 });

  // Find the last attack/throw move by this player
  let moves: MoveRecord[] = [];
  try { moves = JSON.parse(room.movesJson ?? "[]") as MoveRecord[]; } catch { /* empty */ }

  // Find a slot on the table where: (1) undefended, (2) most recent placement of that card was by me.
  // We check "most recent placement" to avoid stealing recall rights for a card that a previous
  // bout introduced and the defender re-used in the current bout.
  let table: TableSlot[] = [];
  try { table = JSON.parse(room.tableJson ?? "[]") as TableSlot[]; } catch { /* empty */ }

  const reversedMoves = [...moves].reverse();
  let slotIdx = -1;
  for (let i = 0; i < table.length; i++) {
    const slot = table[i];
    if (slot.defense !== null) continue;
    const lastPlacement = reversedMoves.find(
      (m) => (m.action === "attack" || m.action === "throw") && m.card && cardsEqual(m.card as Card, slot.attack),
    );
    if (lastPlacement?.seatIdx === mySlot.seatIdx) { slotIdx = i; break; }
  }
  if (slotIdx === -1) return NextResponse.json({ error: "no_recallable_card" }, { status: 400 });

  const recallCard = table[slotIdx].attack;

  // Remove the slot and restore card to player's hand
  const newTable = table.filter((_, i) => i !== slotIdx);
  let hand: Card[] = [];
  try { hand = JSON.parse(mySlot.handJson ?? "[]") as Card[]; } catch { /* empty */ }
  hand.push(recallCard);

  // If table is now empty, phase must return to "attack"
  const newPhase = newTable.length === 0 ? "attack" : room.phase;

  // Append recall to moves log
  const recallEntry: MoveRecord = {
    seq: (moves[moves.length - 1]?.seq ?? 0) + 1,
    seatIdx: mySlot.seatIdx,
    action: "recall" as MoveRecord["action"],
    card: recallCard,
    name: null,
    at: Date.now(),
  };
  moves.push(recallEntry);

  await Promise.all([
    prisma.durakRoom.update({
      where: { id },
      data: {
        tableJson: JSON.stringify(newTable),
        phase: newPhase,
        movesJson: JSON.stringify(moves),
      },
    }),
    prisma.durakPlayerSlot.update({
      where: { roomId_userId: { roomId: id, userId: uid } },
      data: { handJson: JSON.stringify(hand) },
    }),
    prisma.user.update({
      where: { id: uid },
      data: { durakCoins: { decrement: 1 } },
    }),
  ]);

  broadcast(id, { type: "update" });
  return NextResponse.json({ ok: true });
}
