import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();

  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, title: true, content: true, isPremium: true, authorId: true },
  });

  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (post.authorId !== session?.user?.id)
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  return NextResponse.json(post);
}
