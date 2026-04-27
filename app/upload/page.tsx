import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Upload, Zap } from "lucide-react";
import UploadForm from "@/components/UploadForm";
import { getTranslations } from "next-intl/server";

export default async function UploadPage() {
  const [session, t] = await Promise.all([auth(), getTranslations("upload")]);
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
          <h1 className="font-display font-extrabold text-[1.625rem] tracking-[-0.02em] text-[var(--text-primary)]">
            {t("title")}
          </h1>
        </div>
        <p className="text-[var(--text-muted)] text-[0.9rem] pl-[3.25rem]">
          {t("subtitle")}
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
          <p className="font-display font-bold text-[0.8125rem] text-[var(--text-secondary)] mb-1">
            {t("tipsTitle")}
          </p>
          <ul className="text-[var(--text-muted)] text-[0.8125rem] leading-[1.7] pl-4">
            <li>{t("tip1")}</li>
            <li>{t("tip2")}</li>
            <li>{t("tip3")}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
