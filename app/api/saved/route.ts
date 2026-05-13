import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET — список сохранённых видео
export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const saved = await prisma.savedVideo.findMany({
    where: { userId: session.user.id },
    orderBy: { savedAt: "desc" },
    include: {
      video: {
        select: {
          id: true, title: true, duration: true, views: true,
          isPremium: true, thumbnail: true,
          author: { select: { id: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json(saved);
}

// POST { videoId } — добавить в сохранённые
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { videoId } = await req.json() as { videoId: string };

  // createMany с skipDuplicates — безопасно при двойном клике
  await prisma.savedVideo.upsert({
    where: { userId_videoId: { userId: session.user.id, videoId } },
    update: {},  // уже есть — ничего не меняем
    create: { userId: session.user.id, videoId },
  });

  return NextResponse.json({ ok: true });
}

// DELETE { videoId } — убрать из сохранённых
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { videoId } = await req.json() as { videoId: string };

  await prisma.savedVideo.deleteMany({
    where: { userId: session.user.id, videoId },
  });

  return NextResponse.json({ ok: true });
}
