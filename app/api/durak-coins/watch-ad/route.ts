import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const COOLDOWN_MS = 15 * 60 * 1000; // 15 min cooldown between coin ads
const MAX_COINS = 5;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const uid = session.user.id;
  const { videoId } = (await req.json()) as { videoId: string };

  const [user, video] = await Promise.all([
    prisma.user.findUnique({
      where: { id: uid },
      select: { durakCoins: true, lastDurakAdAt: true },
    }),
    prisma.adVideo.findUnique({ where: { id: videoId }, select: { active: true } }),
  ]);

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!video?.active) return NextResponse.json({ error: "Video not available" }, { status: 404 });

  if (user.lastDurakAdAt) {
    const elapsed = Date.now() - new Date(user.lastDurakAdAt).getTime();
    if (elapsed < COOLDOWN_MS) {
      const waitMin = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
      return NextResponse.json({ error: "cooldown", waitMin }, { status: 429 });
    }
  }

  if (user.durakCoins >= MAX_COINS)
    return NextResponse.json({ error: "max_coins", durakCoins: user.durakCoins }, { status: 400 });

  const updated = await prisma.user.update({
    where: { id: uid },
    data: { durakCoins: { increment: 1 }, lastDurakAdAt: new Date() },
    select: { durakCoins: true },
  });

  return NextResponse.json({ ok: true, durakCoins: updated.durakCoins });
}
