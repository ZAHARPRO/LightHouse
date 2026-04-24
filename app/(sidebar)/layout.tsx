import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import SidebarShell from "@/components/SidebarShell";

const SUB_COLORS = ["#f97316", "#6366f1", "#10b981", "#fbbf24", "#ef4444", "#818cf8", "#ec4899", "#14b8a6"];

type Sub = { id: string; name: string; initials: string; color: string; image?: string | null };
type CommunityPost = {
  id: string; title: string; content: string; isPremium: boolean; createdAt: Date;
  author: { id: string; name: string | null; image: string | null; tier: string };
};

export default async function SidebarLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userId = session?.user?.id;

  let subs: Sub[] = [];
  let communityPosts: CommunityPost[] = [];

  if (userId) {
    try {
      const rows = await prisma.subscription.findMany({
        where: { subscriberId: userId, status: "ACTIVE", NOT: { creatorId: userId } },
        orderBy: { startedAt: "desc" },
        take: 10,
        include: { creator: { select: { id: true, name: true, image: true } } },
      });
      subs = rows.map((row: { creator: { id: string; name: string | null; image: string | null } }, i: number) => {
        const name = row.creator.name ?? "Unknown";
        const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
        return { id: row.creator.id, name, initials, color: SUB_COLORS[i % SUB_COLORS.length], image: row.creator.image };
      });

      const subCreatorIds = subs.map((s) => s.id);
      if (subCreatorIds.length > 0) {
        communityPosts = await prisma.post.findMany({
          where: { authorId: { in: subCreatorIds } },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true, title: true, content: true, isPremium: true, createdAt: true,
            author: { select: { id: true, name: true, image: true, tier: true } },
          },
        }) as CommunityPost[];
      }
    } catch { /* DB unavailable */ }
  }

  return (
    <SidebarShell subs={subs} communityPosts={communityPosts} isLoggedIn={!!session}>
      {children}
    </SidebarShell>
  );
}
