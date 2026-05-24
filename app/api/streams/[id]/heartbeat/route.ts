import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const stream = await prisma.stream.findUnique({
    where: { id },
    select: { adminId: true, isActive: true },
  }).catch(() => null);

  if (!stream?.isActive || stream.adminId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.stream.update({ where: { id }, data: { lastHeartbeat: new Date() } });
  return NextResponse.json({ ok: true });
}
