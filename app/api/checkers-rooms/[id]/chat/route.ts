import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text } = await req.json() as { text: string };
  if (!text?.trim()) return NextResponse.json({ error: "Empty" }, { status: 400 });
  if (text.length > 200) return NextResponse.json({ error: "Too long" }, { status: 400 });

  const room = await prisma.checkersRoom.findUnique({ where: { id }, select: { status: true, hostId: true, guestId: true, chatJson: true } });
  if (!room || room.status !== "PLAYING") return NextResponse.json({ error: "Not in game" }, { status: 400 });
  if (room.hostId !== session.user.id && room.guestId !== session.user.id)
    return NextResponse.json({ error: "Not a player" }, { status: 403 });

  const msgs: { userId: string; name: string; text: string; at: number }[] =
    room.chatJson ? JSON.parse(room.chatJson as string) : [];
  msgs.push({ userId: session.user.id!, name: session.user.name ?? "?", text: text.trim(), at: Date.now() });
  if (msgs.length > 100) msgs.splice(0, msgs.length - 100);

  await prisma.checkersRoom.update({ where: { id }, data: { chatJson: JSON.stringify(msgs) } });
  return NextResponse.json({ ok: true });
}
