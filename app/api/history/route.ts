import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// POST /api/history — вызывается при открытии страницы видео
export async function POST(req: Request) {
  const session = await auth();
  // Если не авторизован — тихо игнорируем, не ошибка
  if (!session?.user?.id) return NextResponse.json({ ok: true });

  const { videoId } = await req.json() as { videoId: string };
  if (!videoId) return NextResponse.json({ error: "No videoId" }, { status: 400 });

  // upsert: если запись уже есть — обновляем watchedAt (не создаём дубль)
  await prisma.watchHistory.upsert({
    where: { userId_videoId: { userId: session.user.id, videoId } },
    update: { watchedAt: new Date() },
    create: { userId: session.user.id, videoId },
  });

  return NextResponse.json({ ok: true });
}

// GET /api/history — возвращает последние 50 просмотренных видео
export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const history = await prisma.watchHistory.findMany({
    where: { userId: session.user.id },
    orderBy: { watchedAt: "desc" }, // сначала самые свежие
    take: 50,
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

  return NextResponse.json(history);
}
