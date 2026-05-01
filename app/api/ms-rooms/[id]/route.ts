import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  const room = await prisma.minesweeperRoom.findUnique({
    where: { id },
    include: {
      host:  { select: { id: true, name: true, image: true } },
      guest: { select: { id: true, name: true, image: true } },
    },
  });

  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userId = session?.user?.id ?? null;
  const myRole = userId === room.hostId ? "host" : userId === room.guestId ? "guest" : "spectator";

  const now = Date.now();
  const spectators: { id: string; at: number }[] = room.spectatorsJson ? JSON.parse(room.spectatorsJson as string) : [];
  const spectatorCount = spectators.filter(s => now - s.at < 60_000).length;
  const isHost = myRole === "host";
  const isGuest = myRole === "guest";
  const isFinished = room.status === "FINISHED";

  const parse = (v: string | null) => (v ? (JSON.parse(v) as number[]) : null);

  const hostMines    = parse(room.hostMines);
  const guestMines   = parse(room.guestMines);
  const hostRevealed = parse(room.hostRevealed) ?? [];
  const guestRevealed= parse(room.guestRevealed) ?? [];
  const hostFlagged  = parse(room.hostFlagged) ?? [];
  const guestFlagged = parse(room.guestFlagged) ?? [];

  let myMines: number[] | null, oppMines: number[] | null;
  let myRevealed: number[], oppRevealed: number[];
  let myFlagged: number[], oppFlagged: number[];
  let myHit: boolean, oppHit: boolean;

  if (isHost) {
    myMines = hostMines; myRevealed = hostRevealed; myFlagged = hostFlagged; myHit = room.hostHit;
    oppMines = isFinished ? guestMines : null; oppRevealed = guestRevealed; oppFlagged = guestFlagged; oppHit = room.guestHit;
  } else if (isGuest) {
    myMines = guestMines; myRevealed = guestRevealed; myFlagged = guestFlagged; myHit = room.guestHit;
    oppMines = isFinished ? hostMines : null; oppRevealed = hostRevealed; oppFlagged = hostFlagged; oppHit = room.hostHit;
  } else {
    // Spectator: see both boards without mines (mines only revealed on finish)
    myMines  = isFinished ? hostMines  : null; myRevealed  = hostRevealed;  myFlagged  = hostFlagged;  myHit  = room.hostHit;
    oppMines = isFinished ? guestMines : null; oppRevealed = guestRevealed; oppFlagged = guestFlagged; oppHit = room.guestHit;
  }

  return NextResponse.json({
    id: room.id,
    status: room.status,
    difficulty: room.difficulty,
    rows: room.rows,
    cols: room.cols,
    mineCount: room.mineCount,
    myRole,
    hostReady: room.hostReady,
    guestReady: room.guestReady,
    hostId: room.hostId,
    hostName: room.host.name,
    hostImage: room.host.image,
    guestId: room.guestId,
    guestName: room.guest?.name ?? null,
    guestImage: room.guest?.image ?? null,
    myMines,
    myRevealed,
    myFlagged,
    myHit,
    oppMines,
    oppRevealed,
    oppFlagged,
    oppHit,
    winner: room.winner,
    winReason: room.winReason,
    startedAt: room.startedAt,
    endedAt: room.endedAt,
    rated: room.rated,
    hostEloDelta: room.hostEloDelta,
    guestEloDelta: room.guestEloDelta,
    chat: room.chatJson ? JSON.parse(room.chatJson) : [],
    spectatorCount,
  });
}
