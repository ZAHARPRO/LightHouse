import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { tier: true },
  });

  if (!user || (user.tier !== "PRO" && user.tier !== "ELITE")) {
    return NextResponse.json({ error: "Pro or Elite plan required" }, { status: 403 });
  }

  const { id } = await params;
  const video = await prisma.video.findUnique({
    where: { id },
    select: { url: true, title: true },
  });

  if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });

  return NextResponse.json({ url: video.url, title: video.title });
}
