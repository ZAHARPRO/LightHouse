"use client";

import { useTranslations } from "next-intl";
import { Settings, Zap } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useRawLocale } from "@/components/LocaleProvider";
import { useSession } from "next-auth/react";
import { useState, useTransition } from "react";
import { setScreamersEnabled } from "@/actions/shop";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const locale = useRawLocale();
  const { data: session } = useSession();

  // Screamer toggle state is loaded optimistically; the real value comes from session
  // (we don't have it in session by default, so we store it in localStorage for immediate UI)
  const storageKey = `lh_screamers_${session?.user?.id ?? "guest"}`;
  const [screamersOn, setScreamersOn] = useState(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem(storageKey);
    return v === null ? true : v === "1";
  });
  const [pending, start] = useTransition();

  function toggle() {
    const next = !screamersOn;
    setScreamersOn(next);
    if (typeof window !== "undefined") localStorage.setItem(storageKey, next ? "1" : "0");
    start(async () => {
      await setScreamersEnabled(next);
    });
  }

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

      <div className="space-y-3">
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

        {/* Screamers toggle — only for signed-in users */}
        {session?.user && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(239,68,68,0.12)" }}>
                  <Zap size={15} className="text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-display font-semibold text-[var(--text-primary)]">Screamers</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Allow other users to send you screamer videos. Disabling reduces to &ldquo;soft block&rdquo; — senders see a warning but can still bypass with 3× charges.
                  </p>
                </div>
              </div>
              <button
                onClick={toggle}
                disabled={pending}
                className="relative shrink-0 ml-4 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none"
                style={{ background: screamersOn ? "#ef4444" : "var(--bg-elevated)", border: "1px solid " + (screamersOn ? "rgba(239,68,68,0.5)" : "var(--border-subtle)") }}
                title={screamersOn ? "Disable screamers" : "Enable screamers"}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 shadow-sm"
                  style={{ transform: screamersOn ? "translateX(20px)" : "translateX(0)" }}
                />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
