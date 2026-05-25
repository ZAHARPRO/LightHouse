import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import StreamIdPageClient from "./StreamIdPageClient";

export default async function StreamIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const userId = session.user.id;

  const [stream, msgs, reactions, userReaction, following] = await Promise.all([
    prisma.stream.findUnique({
      where: { id },
      select: {
        id: true, title: true, description: true, thumbnail: true,
        isActive: true, startedAt: true, viewerCount: true, adminId: true,
        admin: { select: { id: true, name: true, image: true } },
      },
    }).catch(() => null),

    prisma.streamChatMessage.findMany({
      where: { streamId: id },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: { id: true, text: true, userName: true, userId: true, isSupport: true, createdAt: true },
    }).catch(() => []),

    prisma.streamReaction.groupBy({
      by: ["type"],
      where: { streamId: id },
      _count: true,
    }).catch(() => []),

    prisma.streamReaction.findUnique({
      where: { userId_streamId: { userId, streamId: id } },
      select: { type: true },
    }).catch(() => null),

    prisma.subscription.findUnique({
      where: { subscriberId_creatorId: { subscriberId: userId, creatorId: id } },
    }).then(() => false).catch(() => false), // placeholder — resolved below
  ]);

  if (!stream) notFound();

  // If this stream ended but the same author is streaming live now → redirect there
  if (!stream.isActive) {
    const liveNow = await prisma.stream.findFirst({
      where: { adminId: stream.adminId, isActive: true, id: { not: id } },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    }).catch(() => null);
    if (liveNow) redirect(`/stream/${liveNow.id}`);
  }

  const followingSub = await prisma.subscription.findUnique({
    where: { subscriberId_creatorId: { subscriberId: userId, creatorId: stream.adminId } },
  }).catch(() => null);

  const likes    = reactions.find((r) => r.type === "LIKE")?._count    ?? 0;
  const dislikes = reactions.find((r) => r.type === "DISLIKE")?._count ?? 0;

  return (
    <StreamIdPageClient
      isStreamOwner={userId === stream.adminId}
      streamId={stream.id}
      userId={userId}
      userName={(session.user as { name?: string }).name ?? "Anonymous"}
      isLoggedIn={true}
      initialStream={{
        ...stream,
        startedAt: stream.startedAt.toISOString(),
        description: stream.description ?? null,
        thumbnail: stream.thumbnail ?? null,
      }}
      initialMessages={msgs.map((m) => ({ ...m, at: m.createdAt.getTime() }))}
      initialLikes={likes}
      initialDislikes={dislikes}
      initialUserReaction={(userReaction?.type ?? null) as "LIKE" | "DISLIKE" | null}
      initialFollowing={!!followingSub}
    />
  );
}
