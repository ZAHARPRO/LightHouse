import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type YTItem = { videoId: string; title: string; channel: string; thumbnail: string };

async function getFavPlaylist(userId: string) {
  let fav = await prisma.playlist.findFirst({ where: { userId, isFavorites: true } });
  if (!fav) {
    fav = await prisma.playlist.create({
      data: { userId, name: "Favorites", isFavorites: true, tracksJson: "[]" },
    });
  }
  return fav;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fav = await getFavPlaylist(session.user.id);
  const tracks: YTItem[] = fav.tracksJson ? JSON.parse(fav.tracksJson) : [];
  return NextResponse.json({ tracks });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await req.json() as YTItem;
  if (!item.videoId) return NextResponse.json({ error: "videoId required" }, { status: 400 });

  const fav = await getFavPlaylist(session.user.id);
  const tracks: YTItem[] = fav.tracksJson ? JSON.parse(fav.tracksJson) : [];
  const exists = tracks.some(t => t.videoId === item.videoId);
  const updated = exists
    ? tracks.filter(t => t.videoId !== item.videoId)
    : [item, ...tracks];

  await prisma.playlist.update({
    where: { id: fav.id },
    data: { tracksJson: JSON.stringify(updated) },
  });

  return NextResponse.json({ favorited: !exists });
}
