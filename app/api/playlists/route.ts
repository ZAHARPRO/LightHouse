import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const playlists = await prisma.playlist.findMany({
    where: { userId: session.user.id, isFavorites: false },
    select: { id: true, name: true, tracksJson: true, isFavorites: true, createdAt: true },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(playlists.map(p => ({
    ...p,
    tracks: p.tracksJson ? JSON.parse(p.tracksJson) : [],
    tracksJson: undefined,
  })));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, tracks } = await req.json() as { name: string; tracks?: unknown[] };
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const playlist = await prisma.playlist.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      tracksJson: tracks ? JSON.stringify(tracks) : null,
    },
  });

  return NextResponse.json({ id: playlist.id, name: playlist.name, tracks: tracks ?? [] });
}
