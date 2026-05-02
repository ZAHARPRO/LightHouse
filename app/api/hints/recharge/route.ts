import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
const MAX_POINTS  = 10;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const uid = session.user.id;
  const { videoId } = (await req.json()) as { videoId: string };

  const [user, video] = await Promise.all([
    prisma.user.findUnique({ where: { id: uid }, select: { hintPoints: true, lastAdWatchedAt: true } }),
    prisma.adVideo.findUnique({ where: { id: videoId }, select: { active: true } }),
  ]);

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!video?.active) return NextResponse.json({ error: "Video not available" }, { status: 404 });

  // Cooldown check
  if (user.lastAdWatchedAt) {
    const elapsed = Date.now() - new Date(user.lastAdWatchedAt).getTime();
    if (elapsed < COOLDOWN_MS) {
      const waitMin = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
      return NextResponse.json({ error: "cooldown", waitMin }, { status: 429 });
    }
  }

  // Already at max
  if (user.hintPoints >= MAX_POINTS)
    return NextResponse.json({ error: "max_points", hintPoints: user.hintPoints }, { status: 400 });

  const updated = await prisma.user.update({
    where: { id: uid },
    data: {
      hintPoints: { increment: 1 },
      lastAdWatchedAt: new Date(),
    },
    select: { hintPoints: true },
  });

  return NextResponse.json({ ok: true, hintPoints: updated.hintPoints });
}
