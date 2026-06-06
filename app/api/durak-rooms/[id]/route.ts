import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeRoom, roomInclude } from "@/lib/durak-room";
import { resolveTimeouts } from "@/lib/durak-engine";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id ?? null;

  let room = await prisma.durakRoom.findUnique({ where: { id }, include: roomInclude });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Track spectator presence for non-players who fetch the room.
  if (userId && !room.players.some((p) => p.userId === userId) && room.status === "PLAYING") {
    const specs: { id: string; at: number }[] = room.spectatorsJson
      ? JSON.parse(room.spectatorsJson)
      : [];
    const filtered = specs.filter((s) => s.id !== userId && Date.now() - s.at < 60_000);
    filtered.push({ id: userId, at: Date.now() });
    await prisma.durakRoom.update({ where: { id }, data: { spectatorsJson: JSON.stringify(filtered) } });
    room.spectatorsJson = JSON.stringify(filtered);
  }

  // Apply any move-timeout that may have elapsed since the last update.
  if (room.status === "PLAYING" && room.timeControl !== "none") {
    const changed = await resolveTimeouts(room);
    if (changed) {
      room = (await prisma.durakRoom.findUnique({ where: { id }, include: roomInclude }))!;
    }
  }

  return NextResponse.json(sanitizeRoom(room, userId));
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const room = await prisma.durakRoom.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (room.hostId !== session.user.id) return NextResponse.json({ error: "Not host" }, { status: 403 });
  if (room.status !== "WAITING") return NextResponse.json({ error: "Game already started" }, { status: 400 });

  const body = (await req.json()) as {
    variant?: string;
    deckSize?: number;
    maxPlayers?: number;
    timeControl?: string;
    throwRule?: string;
    fairPlay?: boolean;
  };

  const data: Record<string, unknown> = {};
  if (body.variant !== undefined)     data.variant     = body.variant === "perevodnoy" ? "perevodnoy" : "podkidnoy";
  if (body.deckSize !== undefined)    data.deckSize    = body.deckSize === 52 ? 52 : 36;
  if (body.maxPlayers !== undefined) {
    const newMax = Math.min(6, Math.max(2, body.maxPlayers));
    data.maxPlayers = newMax;
    // Remove bots whose seat index no longer exists after the player-count change.
    try {
      const bots = JSON.parse(room.botsJson ?? "[]") as { seatIdx: number }[];
      data.botsJson = JSON.stringify(bots.filter((b) => b.seatIdx < newMax));
    } catch {}
  }
  if (body.timeControl !== undefined) data.timeControl = ["15","30","60"].includes(body.timeControl) ? body.timeControl : "none";
  if (body.throwRule !== undefined)   data.throwRule   = body.throwRule === "neighbors" ? "neighbors" : "all";
  if (body.fairPlay !== undefined)    data.fairPlay    = body.fairPlay !== false;

  await prisma.durakRoom.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const updated = await prisma.durakRoom.updateMany({
    where: { id, hostId: session.user.id, status: "WAITING" },
    data: { status: "FINISHED" },
  });
  if (updated.count === 0) return NextResponse.json({ error: "Cannot cancel" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
