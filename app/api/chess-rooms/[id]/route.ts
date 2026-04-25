import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  const room = await prisma.chessRoom.findUnique({
    where: { id },
    include: {
      host:  { select: { id: true, name: true, image: true } },
      guest: { select: { id: true, name: true, image: true } },
    },
  });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userId = session?.user?.id ?? null;
  const myRole = userId === room.hostId ? "host" : userId === room.guestId ? "guest" : "spectator";

  // Compute time remaining (accounting for time elapsed since last move)
  let whiteTimeMs = room.whiteTimeMs;
  let blackTimeMs = room.blackTimeMs;
  if (room.status === "PLAYING" && room.lastMoveAt && room.timeControl !== "none") {
    const elapsed = Date.now() - new Date(room.lastMoveAt).getTime();
    const whiteTurn = (room.fen ?? "").split(" ")[1] === "w";
    if (whiteTurn) whiteTimeMs = Math.max(0, (whiteTimeMs ?? 0) - elapsed);
    else blackTimeMs = Math.max(0, (blackTimeMs ?? 0) - elapsed);
  }

  return NextResponse.json({
    id: room.id,
    status: room.status,
    timeControl: room.timeControl,
    myRole,
    hostId: room.hostId,
    hostName: room.host.name,
    hostImage: room.host.image,
    guestId: room.guestId,
    guestName: room.guest?.name ?? null,
    guestImage: room.guest?.image ?? null,
    hostReady: room.hostReady,
    guestReady: room.guestReady,
    fen: room.fen,
    movesSAN: room.movesSAN ? JSON.parse(room.movesSAN) : [],
    lastMove: room.lastMoveJson ? JSON.parse(room.lastMoveJson) : null,
    whiteTimeMs,
    blackTimeMs,
    winner: room.winner,
    winReason: room.winReason,
    startedAt: room.startedAt,
    endedAt: room.endedAt,
  });
}
