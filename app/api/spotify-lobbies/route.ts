import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const MEMBER_TTL = 30_000;

export async function GET() {
  const now = Date.now();

  const lobbies = await prisma.spotifyLobby.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true, name: true, trackName: true, trackArtist: true, trackImage: true,
      isPlaying: true, membersJson: true, passwordHash: true,
      host: { select: { id: true, name: true, image: true } },
    },
  });

  const fmt = (l: typeof lobbies[number]) => {
    const members = l.membersJson
      ? (JSON.parse(l.membersJson) as { at: number }[]).filter(m => now - m.at < MEMBER_TTL)
      : [];
    return {
      ...l,
      membersJson: undefined,
      hasPassword: !!l.passwordHash,
      passwordHash: undefined,
      memberCount: members.length,
    };
  };

  return NextResponse.json(lobbies.map(fmt));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, password } = await req.json() as { name?: string; password?: string };

  await prisma.spotifyLobby.updateMany({
    where: { hostId: session.user.id, status: "ACTIVE" },
    data: { status: "CLOSED" },
  });

  const lobby = await prisma.spotifyLobby.create({
    data: {
      hostId: session.user.id,
      name: name?.trim() || null,
      passwordHash: password ? await bcrypt.hash(password, 10) : null,
    },
  });

  return NextResponse.json({ id: lobby.id });
}
