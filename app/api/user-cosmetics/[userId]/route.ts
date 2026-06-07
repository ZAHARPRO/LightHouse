import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const CACHE_MS = 60_000; // 1 min server-side cache per request
const cache = new Map<string, { data: unknown; exp: number }>();

export async function GET(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  if (!userId) return NextResponse.json({ frame: null, badges: [] });

  const cached = cache.get(userId);
  if (cached && cached.exp > Date.now()) {
    return NextResponse.json(cached.data, { headers: { "Cache-Control": "public, max-age=60" } });
  }

  try {
    const purchases = await prisma.shopPurchase.findMany({
      where: { userId, item: { active: true, type: { in: ["GAME_FRAME", "BADGE"] } } },
      orderBy: { purchasedAt: "desc" },
      select: { item: { select: { type: true, icon: true, color: true, name: true, sortOrder: true } } },
    });

    const frames = purchases.filter((p) => p.item.type === "GAME_FRAME").map((p) => p.item);
    const badges = purchases.filter((p) => p.item.type === "BADGE").map((p) => p.item).slice(0, 3);

    const data = {
      frame: frames[0] ?? null,
      badges,
    };

    cache.set(userId, { data, exp: Date.now() + CACHE_MS });
    return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch {
    return NextResponse.json({ frame: null, badges: [] });
  }
}
