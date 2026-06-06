import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ mutedUntil: null });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { durakQueueMutedUntil: true },
  });

  const mutedUntil = user?.durakQueueMutedUntil;
  if (!mutedUntil || mutedUntil <= new Date()) {
    return NextResponse.json({ mutedUntil: null });
  }

  return NextResponse.json({ mutedUntil: mutedUntil.toISOString() });
}
