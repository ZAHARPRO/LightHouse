import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOverlay, setOverlay, type OverlayCfg } from "@/lib/stream-overlay";
import { streamSseBroadcast } from "@/lib/stream-sse";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json(getOverlay(id));
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const stream = await prisma.stream.findUnique({ where: { id }, select: { adminId: true } });
  if (!stream || stream.adminId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cfg = await req.json() as OverlayCfg;
  setOverlay(id, cfg);
  streamSseBroadcast(id, { type: "overlay_settings", cam: cfg.cam, support: cfg.support, chatEnabled: cfg.chatEnabled });

  return NextResponse.json({ ok: true });
}
