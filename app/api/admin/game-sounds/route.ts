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
  const sounds = await prisma.gameSound.findMany({ orderBy: { key: "asc" } });
  return NextResponse.json(sounds);
}

export async function POST(req: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { key, label, url, active } = await req.json() as {
    key: string; label: string; url: string; active?: boolean;
  };
  if (!key?.trim() || !url?.trim())
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const sound = await prisma.gameSound.upsert({
    where: { key },
    update: { label: label ?? key, url: url.trim(), active: active ?? true },
    create: { key, label: label ?? key, url: url.trim(), active: active ?? true },
  });
  return NextResponse.json(sound);
}

export async function PATCH(req: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, url, active } = await req.json() as {
    id: string; url?: string; active?: boolean;
  };
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const sound = await prisma.gameSound.update({
    where: { id },
    data: {
      ...(url    !== undefined && { url: url.trim() }),
      ...(active !== undefined && { active }),
    },
  });
  return NextResponse.json(sound);
}

export async function DELETE(req: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await prisma.gameSound.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
