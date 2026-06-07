import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const videos = await prisma.adVideo.findMany({
    where: { active: true },
    select: { id: true, title: true, url: true, duration: true },
  });

  if (videos.length === 0) return NextResponse.json({ error: "No video available" }, { status: 404 });
  const video = videos[Math.floor(Math.random() * videos.length)];
  return NextResponse.json(video);
}
