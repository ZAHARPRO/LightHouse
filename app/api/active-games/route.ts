import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ChessRoomStatus, CheckersRoomStatus, MSRoomStatus, BilliardsRoomStatus } from "@prisma/client";

// How long (ms) until the server forfeits a disconnected player per game/mode.
// Matches the constants in each game's ping route.
function disconnectMs(timeControl: string | null): number {
  return 5 * 60_000; // all games now use 5 min for infinite; timed also 5 min
}

export type ActiveGame = {
  game: string;
  label: string;
  icon: string;
  roomId: string;
  url: string;
  lastSeenAt: number | null;
  expiresAt: number | null; // absolute timestamp when forfeit fires
  opponentName: string | null;
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([], { status: 200 });
  const uid = session.user.id;
  const now = Date.now();

  const results: ActiveGame[] = [];

  // ── Chess ───────────────────────────────────────────────────────────────
  const chess = await prisma.chessRoom.findMany({
    where: { OR: [{ hostId: uid }, { guestId: uid }], status: ChessRoomStatus.PLAYING },
    select: {
      id: true, timeControl: true,
      hostId: true, hostLastSeen: true,
      guestId: true, guestLastSeen: true,
      host: { select: { name: true } },
      guest: { select: { name: true } },
    },
  });
  for (const r of chess) {
    const isHost    = r.hostId === uid;
    const mySeen    = isHost ? r.hostLastSeen : r.guestLastSeen;
    const opponent  = isHost ? r.guest : r.host;
    const lastSeenAt = mySeen ? mySeen.getTime() : null;
    results.push({
      game: "chess", label: "Chess", icon: "♟️",
      roomId: r.id, url: `/games/chess/online/${r.id}`,
      lastSeenAt,
      expiresAt: lastSeenAt !== null ? lastSeenAt + disconnectMs(r.timeControl) : null,
      opponentName: opponent?.name ?? null,
    });
  }

  // ── Checkers ─────────────────────────────────────────────────────────────
  const checkers = await prisma.checkersRoom.findMany({
    where: { OR: [{ hostId: uid }, { guestId: uid }], status: CheckersRoomStatus.PLAYING },
    select: {
      id: true, timeControl: true,
      hostId: true, hostLastSeen: true,
      guestId: true, guestLastSeen: true,
      host: { select: { name: true } },
      guest: { select: { name: true } },
    },
  });
  for (const r of checkers) {
    const isHost    = r.hostId === uid;
    const mySeen    = isHost ? r.hostLastSeen : r.guestLastSeen;
    const opponent  = isHost ? r.guest : r.host;
    const lastSeenAt = mySeen ? mySeen.getTime() : null;
    results.push({
      game: "checkers", label: "Checkers", icon: "🔴",
      roomId: r.id, url: `/games/checkers/online/${r.id}`,
      lastSeenAt,
      expiresAt: lastSeenAt !== null ? lastSeenAt + disconnectMs(r.timeControl) : null,
      opponentName: opponent?.name ?? null,
    });
  }

  // ── Minesweeper ──────────────────────────────────────────────────────────
  const ms = await prisma.minesweeperRoom.findMany({
    where: { OR: [{ hostId: uid }, { guestId: uid }], status: MSRoomStatus.PLAYING },
    select: {
      id: true,
      hostId: true, hostLastSeen: true,
      guestId: true, guestLastSeen: true,
      host: { select: { name: true } },
      guest: { select: { name: true } },
    },
  });
  for (const r of ms) {
    const isHost    = r.hostId === uid;
    const mySeen    = isHost ? r.hostLastSeen : r.guestLastSeen;
    const opponent  = isHost ? r.guest : r.host;
    const lastSeenAt = mySeen ? mySeen.getTime() : null;
    results.push({
      game: "minesweeper", label: "Minesweeper", icon: "💣",
      roomId: r.id, url: `/games/minesweeper/online/${r.id}`,
      lastSeenAt,
      expiresAt: lastSeenAt !== null ? lastSeenAt + disconnectMs(null) : null,
      opponentName: opponent?.name ?? null,
    });
  }

  // ── Battleship ────────────────────────────────────────────────────────────
  const battleship = await prisma.battleshipRoom.findMany({
    where: { OR: [{ hostId: uid }, { guestId: uid }], status: { in: ["PLAYING", "PLACEMENT"] } },
    select: {
      id: true, timeControl: true,
      hostId: true, hostLastSeen: true,
      guestId: true, guestLastSeen: true,
      host: { select: { name: true } },
      guest: { select: { name: true } },
    },
  });
  for (const r of battleship) {
    const isHost    = r.hostId === uid;
    const mySeen    = isHost ? r.hostLastSeen : r.guestLastSeen;
    const opponent  = isHost ? r.guest : r.host;
    const lastSeenAt = mySeen ? mySeen.getTime() : null;
    results.push({
      game: "battleship", label: "Battleship", icon: "🚢",
      roomId: r.id, url: `/games/battleship/online/${r.id}`,
      lastSeenAt,
      expiresAt: lastSeenAt !== null ? lastSeenAt + disconnectMs(r.timeControl) : null,
      opponentName: opponent?.name ?? null,
    });
  }

  // ── Billiards ────────────────────────────────────────────────────────────
  const billiards = await prisma.billiardsRoom.findMany({
    where: { OR: [{ hostId: uid }, { guestId: uid }], status: BilliardsRoomStatus.PLAYING },
    select: {
      id: true, timeControl: true,
      hostId: true, hostLastSeen: true,
      guestId: true, guestLastSeen: true,
      host: { select: { name: true } },
      guest: { select: { name: true } },
    },
  });
  for (const r of billiards) {
    const isHost    = r.hostId === uid;
    const mySeen    = isHost ? r.hostLastSeen : r.guestLastSeen;
    const opponent  = isHost ? r.guest : r.host;
    const lastSeenAt = mySeen ? mySeen.getTime() : null;
    results.push({
      game: "billiards", label: "Billiards", icon: "🎱",
      roomId: r.id, url: `/games/billiards/online/${r.id}`,
      lastSeenAt,
      expiresAt: lastSeenAt !== null ? lastSeenAt + disconnectMs(r.timeControl) : null,
      opponentName: opponent?.name ?? null,
    });
  }

  // ── Durak (multi-player) — WAITING + PLAYING ────────────────────────────
  const durak = await prisma.durakRoom.findMany({
    where: {
      status: { in: ["WAITING", "PLAYING"] },
      OR: [{ hostId: uid }, { players: { some: { userId: uid } } }],
    },
    select: {
      id: true, status: true, timeControl: true, lastMoveAt: true, updatedAt: true,
      players: { select: { userId: true, user: { select: { name: true } } } },
    },
  });
  for (const r of durak) {
    const lastSeenAt = r.lastMoveAt ? r.lastMoveAt.getTime() : r.updatedAt.getTime();
    const opponents  = r.players.filter(p => p.userId !== uid).map(p => p.user.name).filter(Boolean);
    results.push({
      game: "durak", label: "Durak", icon: "🃏",
      roomId: r.id, url: `/games/durak/online/${r.id}`,
      lastSeenAt,
      expiresAt: lastSeenAt !== null ? lastSeenAt + disconnectMs(r.timeControl) : null,
      opponentName: opponents[0] ?? null,
    });
  }

  // Only keep games that haven't expired yet (give 10s grace)
  const active = results.filter(g => g.expiresAt === null || g.expiresAt > now - 10_000);

  return NextResponse.json(active);
}
