import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const MEMBER_TTL = 30_000;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { password } = await req.json().catch(() => ({ password: undefined })) as { password?: string };

  const lobby = await prisma.musicLobby.findUnique({
    where: { id },
    select: { status: true, passwordHash: true, membersJson: true, hostId: true },
  });

  if (!lobby || lobby.status !== "ACTIVE") return NextResponse.json({ error: "Lobby not found" }, { status: 404 });

  if (lobby.passwordHash) {
    if (!password) return NextResponse.json({ error: "Password required" }, { status: 403 });
    const ok = await bcrypt.compare(password, lobby.passwordHash);
    if (!ok) return NextResponse.json({ error: "Wrong password" }, { status: 403 });
  }

  const now = Date.now();
  const members = lobby.membersJson
    ? (JSON.parse(lobby.membersJson) as { id: string; name: string | null; image: string | null; at: number }[])
        .filter(m => now - m.at < MEMBER_TTL && m.id !== session.user.id)
    : [];

  members.push({ id: session.user.id, name: session.user.name ?? null, image: session.user.image ?? null, at: now });

  await prisma.musicLobby.update({
    where: { id },
    data: { membersJson: JSON.stringify(members) },
  });

  return NextResponse.json({ ok: true });
}
