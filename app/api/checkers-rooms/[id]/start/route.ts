import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { initialBoard, boardToJson } from "@/lib/checkers";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const room = await prisma.checkersRoom.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (room.hostId !== session.user.id) return NextResponse.json({ error: "Not host" }, { status: 403 });
  if (room.status !== "WAITING") return NextResponse.json({ error: "Already started" }, { status: 400 });
  if (!room.guestId) return NextResponse.json({ error: "No guest" }, { status: 400 });
  if (!room.guestReady) return NextResponse.json({ error: "Guest not ready" }, { status: 400 });

  const hostColor = Math.random() < 0.5 ? "w" : "b";
  const secs = room.timeControl === "none" ? null : parseInt(room.timeControl, 10) * 1000;
  const board = initialBoard();

  await prisma.checkersRoom.update({
    where: { id },
    data: {
      status: "PLAYING",
      hostColor,
      boardJson: boardToJson(board),
      moveCount: 0,
      mustJumpFrom: null,
      whiteTimeMs: secs,
      blackTimeMs: secs,
      lastMoveAt: new Date(),
      startedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
