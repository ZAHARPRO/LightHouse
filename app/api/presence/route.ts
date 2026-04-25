import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false });
  await prisma.user.update({
    where: { id: session.user.id },
    data: { lastActiveAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const count = await prisma.user.count({
    where: { lastActiveAt: { gt: new Date(Date.now() - 2 * 60 * 1000) } },
  });
  return NextResponse.json({ count });
}
