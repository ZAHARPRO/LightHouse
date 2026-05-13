import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/likes/[videoId] — убрать свой лайк
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { videoId } = await params;

  // deleteMany безопаснее чем delete — не кидает ошибку если записи нет
  await prisma.like.deleteMany({
    where: { userId: session.user.id, videoId },
  });

  return NextResponse.json({ ok: true });
}
