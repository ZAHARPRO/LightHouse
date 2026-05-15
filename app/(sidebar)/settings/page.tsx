"use client";

import { useTranslations } from "next-intl";
import { Settings } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useRawLocale } from "@/components/LocaleProvider";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const locale = useRawLocale();

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
          <Settings size={20} className="text-[var(--accent-orange)]" />
        </div>
        <div>
          <h1 className="text-xl font-display font-bold text-[var(--text-primary)]">{t("title")}</h1>
          <p className="text-sm text-[var(--text-muted)]">{t("subtitle")}</p>
        </div>
      </div>

      {/* Language section */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-visible">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-sm font-display font-semibold text-[var(--text-primary)]">{t("language")}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{t("languageDesc")}</p>
          </div>
          <LanguageSwitcher current={locale} />
        </div>
      </div>
    </div>
  );
}
