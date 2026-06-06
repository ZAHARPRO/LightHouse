import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const room = await prisma.durakRoom.findUnique({
    where: { id },
    select: {
      id: true,
      variant: true,
      deckSize: true,
      movesJson: true,
      deckJson: true,
      winner: true,
      startedAt: true,
      endedAt: true,
      rated: true,
      players: {
        orderBy: { seatIdx: "asc" },
        select: {
          userId: true,
          seatIdx: true,
          eloDelta: true,
          finishPosition: true,
          user: { select: { name: true, image: true } },
        },
      },
    },
  });

  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Parse trump suit/card from deckJson (stored as {deck,trumpSuit,trumpCard})
  let trumpSuit = "S";
  let trumpCard: { suit: string; rank: string } | null = null;
  try {
    const dk = JSON.parse(room.deckJson ?? "{}") as {
      trumpSuit?: string;
      trumpCard?: { suit: string; rank: string } | null;
    };
    if (dk.trumpSuit) trumpSuit = dk.trumpSuit;
    if (dk.trumpCard) trumpCard = dk.trumpCard;
  } catch { /* ignore */ }

  let moves: unknown[] = [];
  try { moves = JSON.parse(room.movesJson ?? "[]"); } catch { /* ignore */ }

  return NextResponse.json({
    id: room.id,
    variant: room.variant,
    deckSize: room.deckSize,
    trumpSuit,
    trumpCard,
    durakUserId: room.winner,
    startedAt: room.startedAt,
    endedAt: room.endedAt,
    rated: room.rated,
    players: room.players.map((p) => ({
      userId: p.userId,
      seatIdx: p.seatIdx,
      name: p.user.name,
      image: p.user.image,
      eloDelta: p.eloDelta,
      finishPosition: p.finishPosition,
      isDurak: p.userId === room.winner,
    })),
    moves,
  });
}
