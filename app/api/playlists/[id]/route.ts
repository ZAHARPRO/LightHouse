import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const playlist = await prisma.playlist.findUnique({ where: { id } });
  if (!playlist || playlist.userId !== session.user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: playlist.id, name: playlist.name,
    tracks: playlist.tracksJson ? JSON.parse(playlist.tracksJson) : [],
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const playlist = await prisma.playlist.findUnique({ where: { id }, select: { userId: true } });
  if (!playlist || playlist.userId !== session.user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, tracks } = await req.json() as { name?: string; tracks?: unknown[] };

  await prisma.playlist.update({
    where: { id },
    data: {
      ...(name ? { name: name.trim() } : {}),
      ...(tracks !== undefined ? { tracksJson: JSON.stringify(tracks) } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const playlist = await prisma.playlist.findUnique({ where: { id }, select: { userId: true } });
  if (!playlist || playlist.userId !== session.user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.playlist.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
