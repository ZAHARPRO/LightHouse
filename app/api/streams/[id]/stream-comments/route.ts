import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const comments = await prisma.streamComment.findMany({
    where: { streamId: id },
    orderBy: [{ isPinned: "desc" }, { createdAt: "asc" }],
    select: {
      id: true, content: true, createdAt: true, isPinned: true, likeCount: true,
      author: { select: { id: true, name: true, image: true } },
    },
  });

  return NextResponse.json(comments);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stream = await prisma.stream.findUnique({ where: { id }, select: { id: true } });
  if (!stream) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { content } = await req.json() as { content?: string };
  if (!content?.trim()) return NextResponse.json({ error: "Empty" }, { status: 400 });
  if (content.length > 2000) return NextResponse.json({ error: "Too long" }, { status: 400 });

  const comment = await prisma.streamComment.create({
    data: { content: content.trim(), streamId: id, authorId: session.user.id },
    select: {
      id: true, content: true, createdAt: true, isPinned: true, likeCount: true,
      author: { select: { id: true, name: true, image: true } },
    },
  });

  return NextResponse.json(comment, { status: 201 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { commentId, action } = await req.json() as { commentId?: string; action?: "pin" | "delete" | "like" };
  if (!commentId || !action) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const stream = await prisma.stream.findUnique({ where: { id }, select: { adminId: true } });
  if (!stream) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const comment = await prisma.streamComment.findUnique({ where: { id: commentId }, select: { id: true, authorId: true, isPinned: true, likeCount: true } });
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "pin") {
    if (session.user.id !== stream.adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await prisma.streamComment.update({ where: { id: commentId }, data: { isPinned: !comment.isPinned } });
  } else if (action === "delete") {
    if (session.user.id !== stream.adminId && session.user.id !== comment.authorId)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await prisma.streamComment.delete({ where: { id: commentId } });
  } else if (action === "like") {
    await prisma.streamComment.update({ where: { id: commentId }, data: { likeCount: { increment: 1 } } });
  }

  return NextResponse.json({ ok: true });
}
