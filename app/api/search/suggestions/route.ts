import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json([]);

  try {
    const [videos, creators, posts] = await Promise.all([
      prisma.video.findMany({
        where: { title: { contains: q, mode: "insensitive" } },
        take: 4,
        orderBy: { views: "desc" },
        select: {
          id: true, title: true, views: true, duration: true,
          author: { select: { name: true } },
        },
      }),
      prisma.user.findMany({
        where: {
          isBanned: false,
          OR: [
            { name:     { contains: q, mode: "insensitive" } },
            { username: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 3,
        select: { id: true, name: true, username: true, image: true, tier: true },
      }),
      prisma.post.findMany({
        where: { title: { contains: q, mode: "insensitive" } },
        take: 3,
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, author: { select: { name: true } } },
      }),
    ]);

    const results = [
      ...videos.map((v) => ({
        type: "video" as const,
        id: v.id,
        label: v.title,
        sub: v.author?.name ?? null,
        href: `/watch/${v.id}`,
      })),
      ...creators.map((u) => ({
        type: "creator" as const,
        id: u.id,
        label: u.name ?? u.username ?? "User",
        sub: u.username ? `@${u.username}` : null,
        href: `/profile/${u.id}`,
        image: u.image,
        tier: u.tier,
      })),
      ...posts.map((p) => ({
        type: "post" as const,
        id: p.id,
        label: p.title,
        sub: p.author?.name ?? null,
        href: `/post/${p.id}`,
      })),
    ];

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
