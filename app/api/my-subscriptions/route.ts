import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([]);

  try {
    const rows = await prisma.subscription.findMany({
      where: {
        subscriberId: session.user.id,
        status: "ACTIVE",
        NOT: { creatorId: session.user.id },
      },
      orderBy: { startedAt: "desc" },
      take: 20,
      include: { creator: { select: { id: true, name: true, tier: true, image: true } } },
    });

    return NextResponse.json(
      rows.map((r: { creator: { id: string; name: string | null; tier: string; image: string | null } }) => ({
        id: r.creator.id,
        name: r.creator.name ?? "Unknown",
        tier: r.creator.tier,
        image: r.creator.image,
      }))
    );
  } catch {
    return NextResponse.json([]);
  }
}