import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const messages = await prisma.announcementMessage.findMany({
      where: { enabled: true },
      select: { id: true, text: true, emoji: true, color: true },
    });
    if (messages.length === 0) return NextResponse.json(null);
    const pick = messages[Math.floor(Math.random() * messages.length)];
    return NextResponse.json(pick);
  } catch {
    return NextResponse.json(null);
  }
}
