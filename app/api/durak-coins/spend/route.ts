import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { durakCoins: true },
  });
  if (!user || user.durakCoins < 1)
    return NextResponse.json({ error: "no_coins" }, { status: 400 });

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: { durakCoins: { decrement: 1 } },
    select: { durakCoins: true },
  });
  return NextResponse.json({ durakCoins: updated.durakCoins });
}
