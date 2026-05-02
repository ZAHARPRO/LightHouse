import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const sounds = await prisma.gameSound.findMany({
    where: { active: true },
    select: { key: true, url: true },
  });
  const map: Record<string, string> = {};
  for (const s of sounds) map[s.key] = s.url;
  return NextResponse.json(map);
}
