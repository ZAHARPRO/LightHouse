import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { streamSseBroadcast } from "@/lib/stream-sse";

// PATCH /api/streams/[id] — admin stops the stream
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const stream = await prisma.stream.findUnique({ where: { id } });
  if (!stream || stream.adminId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.stream.update({
    where: { id },
    data: { isActive: false, endedAt: new Date() },
  });

  // Notify viewers that stream ended
  streamSseBroadcast(id, { type: "stream_ended" });

  return NextResponse.json({ ok: true });
}
