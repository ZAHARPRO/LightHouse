import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rated = searchParams.get("rated") === "true";
  const rooms = await prisma.chessRoom.findMany({
    where: { status: "WAITING", rated },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { host: { select: { id: true, name: true, image: true, chessElo: true } } },
  });
  return NextResponse.json(rooms);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { timeControl = "none", rated = false } = await req.json() as { timeControl?: string; rated?: boolean };

  await prisma.chessRoom.updateMany({
    where: { hostId: session.user.id, status: "WAITING" },
    data: { status: "FINISHED" },
  });

  const user = rated ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { chessElo: true } }) : null;

  const room = await prisma.chessRoom.create({
    data: {
      hostId: session.user.id,
      timeControl,
      rated,
      hostEloSnapshot: user?.chessElo ?? null,
    },
  });

  return NextResponse.json({ id: room.id });
}
