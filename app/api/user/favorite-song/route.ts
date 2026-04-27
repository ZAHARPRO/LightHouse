import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type YTItem = { videoId: string; title: string; channel: string; thumbnail: string } | null;

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item: YTItem = await req.json();

  await prisma.user.update({
    where: { id: session.user.id },
    data: { favoriteSong: item ? JSON.stringify(item) : null },
  });

  return NextResponse.json({ ok: true });
}
