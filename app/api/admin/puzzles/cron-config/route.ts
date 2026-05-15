import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cfg = await prisma.puzzleCronConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, count: 1, intervalDays: 7 },
  });

  return NextResponse.json(cfg);
}

export async function PATCH(req: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { count?: number; intervalDays?: number };
  const count        = typeof body.count        === "number" ? Math.max(1, Math.min(50, body.count))        : undefined;
  const intervalDays = typeof body.intervalDays === "number" ? Math.max(1, Math.min(365, body.intervalDays)) : undefined;

  const cfg = await prisma.puzzleCronConfig.upsert({
    where: { id: 1 },
    update: { ...(count !== undefined && { count }), ...(intervalDays !== undefined && { intervalDays }) },
    create: { id: 1, count: count ?? 1, intervalDays: intervalDays ?? 7 },
  });

  return NextResponse.json(cfg);
}
