import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/billiards-sse";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { power } = await req.json() as { power: number };
  const room = await prisma.billiardsRoom.findUnique({ where: { id }, select: { hostId: true, guestId: true, status: true, currentTurn: true } });
  if (!room || room.status !== "PLAYING") return NextResponse.json({ ok: false });

  const userId = session.user.id;
  const isHost = userId === room.hostId;
  const isGuest = userId === room.guestId;
  if (!isHost && !isGuest) return NextResponse.json({ ok: false });

  // Only update if it's the player's turn
  const myRole = isHost ? "host" : "guest";
  if (room.currentTurn !== myRole) return NextResponse.json({ ok: false });

  await prisma.billiardsRoom.update({
    where: { id },
    data: isHost ? { hostDraftPower: power } : { guestDraftPower: power },
  });

  broadcast(id, { type: "tension", role: isHost ? "host" : "guest", power });
  return NextResponse.json({ ok: true });
}
