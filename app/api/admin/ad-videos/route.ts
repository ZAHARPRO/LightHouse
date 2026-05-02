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
  const videos = await prisma.adVideo.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(videos);
}

export async function POST(req: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, url, duration, active } = await req.json() as {
    title: string; url: string; duration: number; active?: boolean;
  };

  if (!title?.trim() || !url?.trim() || !duration)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const video = await prisma.adVideo.create({
    data: { title: title.trim(), url: url.trim(), duration: Math.max(1, duration), active: active ?? true },
  });
  return NextResponse.json(video);
}

export async function PATCH(req: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, title, url, duration, active } = await req.json() as {
    id: string; title?: string; url?: string; duration?: number; active?: boolean;
  };

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const video = await prisma.adVideo.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(url   !== undefined && { url: url.trim() }),
      ...(duration !== undefined && { duration: Math.max(1, duration) }),
      ...(active !== undefined && { active }),
    },
  });
  return NextResponse.json(video);
}

export async function DELETE(req: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await prisma.adVideo.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
