import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [chess, ms] = await Promise.all([
      prisma.chessRoom.findMany({
        where: { rated: true },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true, status: true,
          hostEloSnapshot: true, guestEloSnapshot: true,
          hostEloDelta: true, guestEloDelta: true,
          resultReverted: true,
          winner: true, winReason: true,
          startedAt: true, endedAt: true, createdAt: true,
          host:  { select: { id: true, name: true, image: true, chessElo: true } },
          guest: { select: { id: true, name: true, image: true, chessElo: true } },
        },
      }),
      prisma.minesweeperRoom.findMany({
        where: { rated: true },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true, status: true,
          hostEloSnapshot: true, guestEloSnapshot: true,
          hostEloDelta: true, guestEloDelta: true,
          resultReverted: true,
          winner: true, winReason: true,
          startedAt: true, endedAt: true, createdAt: true,
          host:  { select: { id: true, name: true, image: true, minesweeperElo: true } },
          guest: { select: { id: true, name: true, image: true, minesweeperElo: true } },
        },
      }),
    ]);

    const result = [
      ...chess.map(r => ({
        ...r,
        game: "chess" as const,
        hostCurrentElo:  r.host.chessElo,
        guestCurrentElo: r.guest?.chessElo ?? null,
      })),
      ...ms.map(r => ({
        ...r,
        game: "minesweeper" as const,
        hostCurrentElo:  r.host.minesweeperElo,
        guestCurrentElo: r.guest?.minesweeperElo ?? null,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[admin/rooms GET]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json() as {
      action: "close" | "revert";
      game: "chess" | "minesweeper";
      id: string;
    };

    if (!body.action || !body.game || !body.id)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    if (body.action === "close") {
      if (body.game === "chess") {
        const room = await prisma.chessRoom.findUnique({ where: { id: body.id } });
        if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (room.status === "FINISHED")
          return NextResponse.json({ error: "Already finished" }, { status: 400 });
        await prisma.chessRoom.update({
          where: { id: body.id },
          data: { status: "FINISHED", winner: null, winReason: "cancelled", endedAt: new Date() },
        });
      } else {
        const room = await prisma.minesweeperRoom.findUnique({ where: { id: body.id } });
        if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (room.status === "FINISHED")
          return NextResponse.json({ error: "Already finished" }, { status: 400 });
        await prisma.minesweeperRoom.update({
          where: { id: body.id },
          data: { status: "FINISHED", winner: null, winReason: "cancelled", endedAt: new Date() },
        });
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === "revert") {
      if (body.game === "chess") {
        const room = await prisma.chessRoom.findUnique({
          where: { id: body.id },
          include: { host: true, guest: true },
        });
        if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (room.status !== "FINISHED")
          return NextResponse.json({ error: "Room not finished" }, { status: 400 });
        if (room.resultReverted)
          return NextResponse.json({ error: "Already reverted" }, { status: 400 });
        if (room.hostEloDelta == null)
          return NextResponse.json({ error: "No ELO to revert" }, { status: 400 });

        await prisma.$transaction([
          prisma.chessRoom.update({ where: { id: body.id }, data: { resultReverted: true } }),
          prisma.user.update({ where: { id: room.hostId }, data: { chessElo: { decrement: room.hostEloDelta } } }),
          ...(room.guestId && room.guestEloDelta != null
            ? [prisma.user.update({ where: { id: room.guestId }, data: { chessElo: { decrement: room.guestEloDelta } } })]
            : []),
        ]);
      } else {
        const room = await prisma.minesweeperRoom.findUnique({
          where: { id: body.id },
          include: { host: true, guest: true },
        });
        if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (room.status !== "FINISHED")
          return NextResponse.json({ error: "Room not finished" }, { status: 400 });
        if (room.resultReverted)
          return NextResponse.json({ error: "Already reverted" }, { status: 400 });
        if (room.hostEloDelta == null)
          return NextResponse.json({ error: "No ELO to revert" }, { status: 400 });

        await prisma.$transaction([
          prisma.minesweeperRoom.update({ where: { id: body.id }, data: { resultReverted: true } }),
          prisma.user.update({ where: { id: room.hostId }, data: { minesweeperElo: { decrement: room.hostEloDelta } } }),
          ...(room.guestId && room.guestEloDelta != null
            ? [prisma.user.update({ where: { id: room.guestId }, data: { minesweeperElo: { decrement: room.guestEloDelta } } })]
            : []),
        ]);
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[admin/rooms POST]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
