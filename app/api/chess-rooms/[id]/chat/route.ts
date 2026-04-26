import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type ChatMsg = { userId: string; name: string; text: string; at: number };

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text } = await req.json() as { text: string };
  if (!text?.trim() || text.length > 200) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const room = await prisma.chessRoom.findUnique({
    where: { id },
    select: { chatJson: true, hostId: true, guestId: true, status: true },
  });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (room.status !== "PLAYING") return NextResponse.json({ error: "Game not active" }, { status: 400 });

  const isPlayer = session.user.id === room.hostId || session.user.id === room.guestId;
  if (!isPlayer) return NextResponse.json({ error: "Not a player" }, { status: 403 });

  const msgs: ChatMsg[] = room.chatJson ? JSON.parse(room.chatJson) : [];
  msgs.push({ userId: session.user.id, name: session.user.name ?? "Player", text: text.trim(), at: Date.now() });
  if (msgs.length > 100) msgs.splice(0, msgs.length - 100);

  await prisma.chessRoom.update({ where: { id }, data: { chatJson: JSON.stringify(msgs) } });
  return NextResponse.json({ ok: true });
}
