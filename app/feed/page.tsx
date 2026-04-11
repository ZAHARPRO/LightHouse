import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import FeedLayout from "@/components/FeedLayout";

const MOCK_VIDEOS = [
  { id: "1", title: "Месим глину с красивыми парнями ;)", author: { name: "Orcistanchik", image: null }, views: 1489, isPremium: false, duration: 3050, _count: { likes: 241, comments: 12 } },
  { id: "2", title: "Почему рабство стоит вернуть", author: { name: "Orcistanchik", image: null }, views: 9, isPremium: false, duration: 101, _count: { likes: 3, comments: 1 } },
  { id: "3", title: "Інтерв'ю з Тарантіничем", author: { name: "Charlie Penguin", image: null }, views: 909, isPremium: false, duration: 98, _count: { likes: 87, comments: 9 } },
  { id: "4", title: "Shovel Knight OST — Full Album", author: { name: "SuperFreak", image: null }, views: 42000, isPremium: true, duration: 4200, _count: { likes: 1800, comments: 55 } },
  { id: "5", title: "How to Build a Next.js App", author: { name: "Charlie Penguin", image: null }, views: 7800, isPremium: false, duration: 1920, _count: { likes: 320, comments: 28 } },
  { id: "6", title: "Deep Focus Study Session", author: { name: "LoFi Lab", image: null }, views: 215000, isPremium: false, duration: 7200, _count: { likes: 8900, comments: 420 } },
  { id: "7", title: "Mastering Prisma ORM", author: { name: "DB Wizard", image: null }, views: 33800, isPremium: false, duration: 1800, _count: { likes: 1100, comments: 73 } },
  { id: "8", title: "Tokyo Night Walk 4K", author: { name: "Marco Visuals", image: null }, views: 89500, isPremium: true, duration: 1240, _count: { likes: 3200, comments: 156 } },
];

const SUB_COLORS = ["#f97316", "#6366f1", "#10b981", "#fbbf24", "#ef4444", "#818cf8", "#ec4899", "#14b8a6"];

const MOCK_POST = {
  user: { name: "Shovel Knight", initials: "SK", color: "#fbbf24" },
  text: "New level dropping next week — get ready for the toughest boss yet 🗡️",
  likes: 41, comments: 2, views: 89, reach: 201,
};

export default async function FeedPage() {
  const session = await auth();

  let videos: typeof MOCK_VIDEOS = [];
  try {
    const dbVideos = await prisma.video.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, title: true, thumbnail: true, views: true,
        isPremium: true, duration: true,
        author: { select: { id: true, name: true, image: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });
    videos = dbVideos.length > 0 ? (dbVideos as typeof MOCK_VIDEOS) : MOCK_VIDEOS;
  } catch {
    videos = MOCK_VIDEOS;
  }

  // Sidebar subscriptions — real data for logged-in user, empty otherwise
  type Sub = { id: string; name: string; initials: string; color: string };
  let subs: Sub[] = [];
  if (session?.user?.id) {
    try {
      const rows = await prisma.subscription.findMany({
        where: {
          subscriberId: session.user.id,
          status: "ACTIVE",
          // exclude self-subscriptions (platform plan)
          NOT: { creatorId: session.user.id },
        },
        orderBy: { startedAt: "desc" },
        take: 10,
        include: { creator: { select: { id: true, name: true } } },
      });
      subs = rows.map((row: { creator: { id: string; name: string | null } }, i: number) => {
        const name = row.creator.name ?? "Unknown";
        const initials = name
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
        return {
          id: row.creator.id,
          name,
          initials,
          color: SUB_COLORS[i % SUB_COLORS.length],
        };
      });
    } catch {
      // DB unavailable — show empty
    }
  }

  return (
    <FeedLayout
      videos={videos}
      userTier={session ? "FREE" : null}
      featuredVideo={videos[3] ?? MOCK_VIDEOS[3]}
      subs={subs}
      post={MOCK_POST}
      isLoggedIn={!!session}
    />
  );
}
