import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rooms = await prisma.chessRoom.findMany({
    where: { status: "WAITING" },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { host: { select: { id: true, name: true, image: true } } },
  });
  return NextResponse.json(rooms);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { timeControl = "none" } = await req.json() as { timeControl?: string };

  await prisma.chessRoom.updateMany({
    where: { hostId: session.user.id, status: "WAITING" },
    data: { status: "FINISHED" },
  });

  const room = await prisma.chessRoom.create({
    data: { hostId: session.user.id, timeControl },
  });

  return NextResponse.json({ id: room.id });
}
