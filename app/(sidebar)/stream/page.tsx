import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import StreamPageClient from "./StreamPageClient";

export default async function StreamPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  // Non-admins go to active stream or feed
  if (session.user.role !== "ADMIN") {
    const active = await prisma.stream.findFirst({
      where: { isActive: true },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    }).catch(() => null);
    redirect(active ? `/stream/${active.id}` : "/feed");
  }

  // Check if this admin already has an active stream
  const existing = await prisma.stream.findFirst({
    where: { adminId: session.user.id, isActive: true },
    select: { id: true },
  }).catch(() => null);

  if (existing) redirect(`/stream/${existing.id}`);

  return (
    <StreamPageClient
      userId={session.user.id}
      userName={(session.user as { name?: string }).name ?? "Anonymous"}
    />
  );
}
