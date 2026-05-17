import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sseBroadcast } from "@/lib/lobby-sse";

const MEMBER_TTL   = 30_000;
const REJOIN_GRACE = 300_000; // 5 min — skip password if recently was a member

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

  const now = Date.now();
  const rawMembers = lobby.membersJson
    ? (JSON.parse(lobby.membersJson) as { id: string; name: string | null; image: string | null; at: number }[])
    : [];

  const isHost           = session.user.id === lobby.hostId;
  const wasRecentMember  = rawMembers.some(m => m.id === session.user.id && now - m.at < REJOIN_GRACE);

  if (lobby.passwordHash && !isHost && !wasRecentMember) {
    if (!password) return NextResponse.json({ error: "Password required" }, { status: 403 });
    const ok = await bcrypt.compare(password, lobby.passwordHash);
    if (!ok) return NextResponse.json({ error: "Wrong password" }, { status: 403 });
  }

  const members = rawMembers.filter(m => now - m.at < MEMBER_TTL && m.id !== session.user.id);

  members.push({ id: session.user.id, name: session.user.name ?? null, image: session.user.image ?? null, at: now });

  await prisma.musicLobby.update({
    where: { id },
    data: { membersJson: JSON.stringify(members) },
  });

  sseBroadcast(id, { members });

  return NextResponse.json({ ok: true });
}
