import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const video = await prisma.adVideo.findFirst({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, url: true, duration: true },
  });

  if (!video) return NextResponse.json({ error: "No video available" }, { status: 404 });
  return NextResponse.json(video);
}
