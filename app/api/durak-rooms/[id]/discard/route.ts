import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Card } from "@/lib/durak";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const room = await prisma.durakRoom.findUnique({
    where: { id },
    select: { discardJson: true, status: true },
  });

  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (room.status !== "PLAYING") return NextResponse.json({ error: "Game not in progress" }, { status: 400 });

  let cards: Card[] = [];
  try { cards = JSON.parse(room.discardJson ?? "[]") as Card[]; } catch { /* empty */ }

  return NextResponse.json({ cards });
}
