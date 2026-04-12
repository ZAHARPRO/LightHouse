import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Upload, Zap } from "lucide-react";
import UploadForm from "@/components/UploadForm";

export default async function UploadPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="max-w-[680px] mx-auto px-6 py-10">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-[10px] bg-orange-500/[0.12] border border-orange-500/25 flex items-center justify-center">
            <Upload size={19} color="var(--accent-orange)" />
          </div>
          <h1 className="font-[var(--font-display)] font-extrabold text-[1.625rem] tracking-[-0.02em] text-[var(--text-primary)]">
            Upload Video
          </h1>
        </div>
        <p className="text-[var(--text-muted)] text-[0.9rem] pl-[3.25rem]">
          Share your content with the LightHouse community
        </p>
      </div>

      {/* Card */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-8">
        <UploadForm categories={categories} />
      </div>

      {/* Tips */}
      <div className="mt-6 py-4 px-5 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex gap-3 items-start">
        <Zap size={15} color="var(--accent-orange)" className="shrink-0 mt-0.5" />
        <div>
          <p className="font-[var(--font-display)] font-bold text-[0.8125rem] text-[var(--text-secondary)] mb-1">
            Tips
          </p>
          <ul className="text-[var(--text-muted)] text-[0.8125rem] leading-[1.7] pl-4">
            <li>Paste a direct link to an <code>.mp4</code>, <code>.webm</code>, or any browser-playable format</li>
            <li>Duration is in seconds — 1 hour = 3600</li>
            <li>Premium videos are only visible to active subscribers</li>
          </ul>
        </div>
      </div>
    </div>
  );
}