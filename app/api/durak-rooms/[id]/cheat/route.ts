import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/durak-sse";
import type { Card } from "@/lib/durak";
import type { PendingCheat } from "@/lib/durak-room";

const CATCH_WINDOW_MS = 3000;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { type } = (await req.json()) as { type: "peek" | "extra_draw" };
  if (type !== "peek" && type !== "extra_draw") return NextResponse.json({ error: "Bad type" }, { status: 400 });

  const room = await prisma.durakRoom.findUnique({
    where: { id },
    include: { players: { orderBy: { seatIdx: "asc" } } },
  });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (room.status !== "PLAYING") return NextResponse.json({ error: "Not playing" }, { status: 400 });
  if (room.fairPlay) return NextResponse.json({ error: "Fair-play room" }, { status: 400 });

  const mySlot = room.players.find((p) => p.userId === userId);
  if (!mySlot) return NextResponse.json({ error: "Not a player" }, { status: 403 });

  // A previous cheat must have expired before a new one is allowed.
  if (room.pendingCheatJson) {
    const prev = JSON.parse(room.pendingCheatJson) as PendingCheat;
    if (prev.expiresAt > Date.now()) return NextResponse.json({ error: "Cheat in progress" }, { status: 400 });
  }

  const now = Date.now();
  let pending: PendingCheat;
  let peekedCard: Card | null = null;

  if (type === "peek") {
    // Pick a random opponent and reveal one of their cards to the cheater only.
    const others = room.players.filter((p) => p.userId !== userId && !p.isOut);
    if (others.length === 0) return NextResponse.json({ error: "No targets" }, { status: 400 });
    const target = others[Math.floor(Math.random() * others.length)];
    const hand = JSON.parse(target.handJson) as Card[];
    if (hand.length === 0) return NextResponse.json({ error: "Empty hand" }, { status: 400 });
    peekedCard = hand[Math.floor(Math.random() * hand.length)];
    pending = {
      type: "peek",
      cheaterIdx: mySlot.seatIdx,
      targetIdx: target.seatIdx,
      card: peekedCard,
      expiresAt: now + CATCH_WINDOW_MS,
    };
  } else {
    // Sneak an extra card from the deck into the cheater's hand.
    const deck = JSON.parse(room.deckJson) as Card[];
    if (deck.length === 0) return NextResponse.json({ error: "Deck empty" }, { status: 400 });
    const card = deck.shift()!;
    const hand = JSON.parse(mySlot.handJson) as Card[];
    hand.push(card);
    await prisma.$transaction([
      prisma.durakRoom.update({ where: { id }, data: { deckJson: JSON.stringify(deck) } }),
      prisma.durakPlayerSlot.update({ where: { id: mySlot.id }, data: { handJson: JSON.stringify(hand) } }),
    ]);
    pending = {
      type: "extra_draw",
      cheaterIdx: mySlot.seatIdx,
      targetIdx: null,
      card: null,
      expiresAt: now + CATCH_WINDOW_MS,
    };
  }

  await prisma.durakRoom.update({ where: { id }, data: { pendingCheatJson: JSON.stringify(pending) } });

  broadcast(id, { type: "cheat_alert", cheaterName: session.user.name ?? "?", cheatType: type });
  broadcast(id, { type: "update" });

  return NextResponse.json({ ok: true, peekedCard });
}
