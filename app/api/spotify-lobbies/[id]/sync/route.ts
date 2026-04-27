import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const MAX_HISTORY = 50;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const lobby = await prisma.spotifyLobby.findUnique({
    where: { id },
    select: { hostId: true, status: true, trackUri: true, historyJson: true },
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

  // Append to history when a new track starts (different videoId, near position 0)
  let historyJson = lobby.historyJson;
  const isNewTrack = body.trackUri && body.trackUri !== lobby.trackUri;
  if (isNewTrack && body.trackUri) {
    const history: { videoId: string; title: string; channel: string; thumbnail: string; at: number }[] =
      historyJson ? JSON.parse(historyJson) : [];
    // Avoid duplicate consecutive entries
    if (history[0]?.videoId !== body.trackUri) {
      history.unshift({
        videoId:   body.trackUri,
        title:     body.trackName   ?? "",
        channel:   body.trackArtist ?? "",
        thumbnail: body.trackImage  ?? "",
        at:        Date.now(),
      });
      if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
      historyJson = JSON.stringify(history);
    }
  }

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
      ...(historyJson !== lobby.historyJson ? { historyJson } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
