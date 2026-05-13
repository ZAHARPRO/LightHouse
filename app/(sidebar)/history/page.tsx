import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import HistoryTabs from "@/components/HistoryTabs";

export default async function HistoryPage() {
  const t = await getTranslations("history");
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  const uid = session.user.id;

  // Порядок в Promise.all совпадает с порядком в деструктуризации
  const [history, liked, saved, viewer] = await Promise.all([

    // 1 → history
    prisma.watchHistory.findMany({
      where: { userId: uid },
      orderBy: { watchedAt: "desc" },
      take: 50,
      select: {
        watchedAt: true,
        video: {
          select: {
            id: true, title: true, duration: true,
            views: true, isPremium: true,
            author: { select: { id: true, name: true } },
          },
        },
      },
    }),

    // 2 → liked
    prisma.like.findMany({
      where: { userId: uid, type: "LIKE" },
      orderBy: { createdAt: "desc" },
      select: {
        video: {
          select: {
            id: true, title: true, duration: true,
            views: true, isPremium: true,
            author: { select: { id: true, name: true } },
          },
        },
      },
    }),

    // 3 → saved
    prisma.savedVideo.findMany({
      where: { userId: uid },
      orderBy: { savedAt: "desc" },
      select: {
        video: {
          select: {
            id: true, title: true, duration: true,
            views: true, isPremium: true,
            author: { select: { id: true, name: true } },
          },
        },
      },
    }),

    // 4 → viewer (тир нужен для кнопки скачать)
    prisma.user.findUnique({
      where: { id: uid },
      select: { tier: true },
    }),
  ]);

  const userTier = viewer?.tier ?? null;
  const likedVideos   = liked.map((l) => l.video);
  const savedVideos   = saved.map((s) => s.video);
  const historyVideos = history.map((h) => ({ ...h.video, watchedAt: h.watchedAt }));

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="font-display font-extrabold text-2xl text-[var(--text-primary)] mb-6">
        {t("title")}
      </h1>

      <HistoryTabs
        history={historyVideos}
        liked={likedVideos}
        saved={savedVideos}
        userTier={userTier}
      />
    </div>
  );
}
