import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/durak-sse";

type BotEntry = { seatIdx: number; difficulty: string; handJson: string; isOut: boolean };

function parseBots(raw: string): BotEntry[] {
  try { return JSON.parse(raw) as BotEntry[]; } catch { return []; }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { action: "add" | "remove"; seatIdx: number; difficulty?: string };
  const { action, seatIdx, difficulty = "medium" } = body;

  const room = await prisma.durakRoom.findUnique({
    where: { id },
    include: { players: { select: { seatIdx: true } } },
  });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (room.hostId !== session.user.id) return NextResponse.json({ error: "Not host" }, { status: 403 });
  if (room.status !== "WAITING") return NextResponse.json({ error: "Game already started" }, { status: 400 });
  if (seatIdx < 0 || seatIdx >= room.maxPlayers) return NextResponse.json({ error: "Invalid seat" }, { status: 400 });

  const bots = parseBots(room.botsJson);
  const realSeats = new Set(room.players.map((p) => p.seatIdx));

  if (action === "add") {
    if (realSeats.has(seatIdx)) return NextResponse.json({ error: "Seat taken by player" }, { status: 400 });
    if (bots.some((b) => b.seatIdx === seatIdx)) return NextResponse.json({ error: "Bot already here" }, { status: 400 });
    const valid = ["easy", "medium", "hard"];
    if (!valid.includes(difficulty)) return NextResponse.json({ error: "Bad difficulty" }, { status: 400 });
    bots.push({ seatIdx, difficulty, handJson: "[]", isOut: false });
  } else {
    const idx = bots.findIndex((b) => b.seatIdx === seatIdx);
    if (idx < 0) return NextResponse.json({ error: "No bot at that seat" }, { status: 400 });
    bots.splice(idx, 1);
  }

  await prisma.durakRoom.update({ where: { id }, data: { botsJson: JSON.stringify(bots) } });
  broadcast(id, { type: "update" });
  return NextResponse.json({ ok: true });
}
