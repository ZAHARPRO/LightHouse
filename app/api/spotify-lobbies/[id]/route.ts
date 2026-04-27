import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const MEMBER_TTL  = 30_000;
const EMPTY_CLOSE = 5 * 60 * 1000; // 5 minutes

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const lobby = await prisma.spotifyLobby.findUnique({
    where: { id },
    select: {
      id: true, name: true, status: true,
      trackUri: true, trackName: true, trackArtist: true, trackImage: true,
      positionMs: true, isPlaying: true, syncedAt: true, membersJson: true,
      historyJson: true, passwordHash: true, updatedAt: true,
      host: { select: { id: true, name: true, image: true } },
    },
  });

  if (!lobby) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = Date.now();
  const members = lobby.membersJson
    ? (JSON.parse(lobby.membersJson) as { id: string; name: string | null; image: string | null; at: number }[])
        .filter(m => now - m.at < MEMBER_TTL)
    : [];

  // Auto-close if lobby has been empty for 5+ minutes
  if (
    lobby.status === "ACTIVE" &&
    members.length === 0 &&
    now - new Date(lobby.updatedAt).getTime() > EMPTY_CLOSE
  ) {
    await prisma.spotifyLobby.update({ where: { id }, data: { status: "CLOSED" } });
    return NextResponse.json({ error: "Lobby closed (empty)." }, { status: 404 });
  }

  const history = lobby.historyJson ? JSON.parse(lobby.historyJson) : [];

  return NextResponse.json({
    ...lobby,
    membersJson: undefined,
    historyJson: undefined,
    passwordHash: undefined,
    updatedAt: undefined,
    hasPassword: !!lobby.passwordHash,
    members,
    history,
    elapsedMs: lobby.isPlaying ? now - new Date(lobby.syncedAt).getTime() : 0,
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const lobby = await prisma.spotifyLobby.findUnique({ where: { id }, select: { hostId: true } });
  if (!lobby) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (lobby.hostId === session.user.id) {
    await prisma.spotifyLobby.update({ where: { id }, data: { status: "CLOSED" } });
  } else {
    const existing = await prisma.spotifyLobby.findUnique({
      where: { id }, select: { membersJson: true },
    });
    const members = existing?.membersJson
      ? (JSON.parse(existing.membersJson) as { id: string }[]).filter(m => m.id !== session.user.id)
      : [];
    await prisma.spotifyLobby.update({
      where: { id },
      data: { membersJson: JSON.stringify(members) },
    });
  }

  return NextResponse.json({ ok: true });
}
