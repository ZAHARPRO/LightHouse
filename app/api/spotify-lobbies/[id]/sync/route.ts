import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const lobby = await prisma.spotifyLobby.findUnique({
    where: { id },
    select: { hostId: true, status: true },
  });

  if (!lobby || lobby.status !== "ACTIVE") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (lobby.hostId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as {
    trackUri?: string;
    trackName?: string;
    trackArtist?: string;
    trackImage?: string;
    positionMs?: number;
    isPlaying?: boolean;
  };

  await prisma.spotifyLobby.update({
    where: { id },
    data: {
      trackUri:    body.trackUri    ?? null,
      trackName:   body.trackName   ?? null,
      trackArtist: body.trackArtist ?? null,
      trackImage:  body.trackImage  ?? null,
      positionMs:  body.positionMs  ?? 0,
      isPlaying:   body.isPlaying   ?? false,
      syncedAt:    new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
