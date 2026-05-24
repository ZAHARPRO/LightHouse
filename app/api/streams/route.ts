import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/streams — active streams (for feed row)
export async function GET() {
  try {
    const streams = await prisma.stream.findMany({
      where: { isActive: true },
      orderBy: { startedAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        startedAt: true,
        viewerCount: true,
        admin: { select: { id: true, name: true, image: true } },
      },
    });
    return NextResponse.json(streams);
  } catch {
    return NextResponse.json([]);
  }
}

// POST /api/streams — admin starts a stream
export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const title       = (body.title as string | undefined)?.trim() || "Live Stream";
  const description = (body.description as string | undefined)?.trim() || null;
  const thumbnail   = (body.thumbnail as string | undefined) || null;

  // Deactivate any previous streams by this admin
  await prisma.stream.updateMany({
    where: { adminId: session.user.id, isActive: true },
    data: { isActive: false, endedAt: new Date() },
  });

  const stream = await prisma.stream.create({
    data: { adminId: session.user.id, title, description, thumbnail },
    select: { id: true, title: true, description: true, thumbnail: true, startedAt: true },
  });

  return NextResponse.json(stream, { status: 201 });
}
