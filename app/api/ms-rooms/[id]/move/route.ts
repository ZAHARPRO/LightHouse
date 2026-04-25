import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateMines, computeNeighbors, floodReveal, checkWin } from "@/lib/minesweeper";
import { BADGE_DEFS } from "@/lib/badges";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, idx } = await req.json() as { type: "reveal" | "flag"; idx: number };

  const room = await prisma.minesweeperRoom.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (room.status !== "PLAYING") return NextResponse.json({ error: "Not in game" }, { status: 400 });

  const userId = session.user.id;
  const isHost = userId === room.hostId;
  const isGuest = userId === room.guestId;
  if (!isHost && !isGuest) return NextResponse.json({ error: "Not a player" }, { status: 403 });

  // If the player already lost/won, ignore further moves
  if (isHost && room.hostHit) return NextResponse.json({ ok: true });
  if (isGuest && room.guestHit) return NextResponse.json({ ok: true });

  const rows = room.rows!, cols = room.cols!, mineCount = room.mineCount!;

  const parsedMines    = isHost ? room.hostMines    : room.guestMines;
  const parsedRevealed = isHost ? room.hostRevealed : room.guestRevealed;
  const parsedFlagged  = isHost ? room.hostFlagged  : room.guestFlagged;

  let mines: number[] | null = parsedMines ? JSON.parse(parsedMines) : null;
  let revealed = new Set<number>(parsedRevealed ? JSON.parse(parsedRevealed) : []);
  let flagged  = new Set<number>(parsedFlagged  ? JSON.parse(parsedFlagged)  : []);

  const minesKey    = isHost ? "hostMines"    : "guestMines";
  const revealedKey = isHost ? "hostRevealed" : "guestRevealed";
  const flaggedKey  = isHost ? "hostFlagged"  : "guestFlagged";
  const hitKey      = isHost ? "hostHit"      : "guestHit";

  const updateData: Record<string, unknown> = {};

  if (type === "flag") {
    if (revealed.has(idx)) return NextResponse.json({ ok: true });
    if (flagged.has(idx)) flagged.delete(idx); else flagged.add(idx);
    updateData[flaggedKey] = JSON.stringify([...flagged]);
  } else {
    if (revealed.has(idx) || flagged.has(idx)) return NextResponse.json({ ok: true });

    // Generate mines on first reveal (safe zone around first click)
    if (!mines) {
      mines = generateMines(rows, cols, mineCount, idx);
      updateData[minesKey] = JSON.stringify(mines);
    }

    const mineSet = new Set(mines);

    if (mineSet.has(idx)) {
      // Player hit a mine — reveal all mines on their board
      const exploded = new Set(revealed);
      for (const m of mineSet) exploded.add(m);
      updateData[revealedKey] = JSON.stringify([...exploded]);
      updateData[hitKey] = true;
      updateData.status = "FINISHED";
      updateData.winner = isHost ? "guest" : "host";
      updateData.winReason = "exploded";
      updateData.endedAt = new Date();
    } else {
      const neighbors = computeNeighbors(rows, cols, mineSet);
      revealed = floodReveal(rows, cols, mineSet, neighbors, revealed, idx);
      updateData[revealedKey] = JSON.stringify([...revealed]);

      if (checkWin(rows, cols, mineCount, revealed)) {
        updateData.status = "FINISHED";
        updateData.winner = isHost ? "host" : "guest";
        updateData.winReason = "cleared";
        updateData.endedAt = new Date();
      }
    }
  }

  await prisma.minesweeperRoom.update({ where: { id }, data: updateData });

  // Auto-award badges if game just ended with a clear
  if (updateData.status === "FINISHED" && updateData.winReason === "cleared") {
    const winnerId = updateData.winner === "host" ? room.hostId : room.guestId;
    if (winnerId) {
      const badgesToAward = ["MINESWEEPER_WIN", "MINESWEEPER_ONLINE_WIN"];
      for (const type of badgesToAward) {
        const def = BADGE_DEFS[type];
        const existing = await prisma.reward.findFirst({ where: { userId: winnerId, type: type as never } });
        if (!existing) {
          await prisma.$transaction([
            prisma.reward.create({ data: { userId: winnerId, type: type as never, pointsValue: def.points, description: def.description } }),
            prisma.user.update({ where: { id: winnerId }, data: { points: { increment: def.points } } }),
          ]);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
