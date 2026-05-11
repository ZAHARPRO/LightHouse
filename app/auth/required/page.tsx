"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogIn, Lock } from "lucide-react";

export default function AuthRequired() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [seconds, setSeconds] = useState(5);

  useEffect(() => {
    if (seconds <= 0) {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }
    const timer = setTimeout(() => setSeconds(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds, router, callbackUrl]);

  function goSignIn() {
    router.push(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-8 text-center shadow-xl">
        <div className="w-14 h-14 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-5">
          <Lock size={24} className="text-[var(--accent-orange)]" />
        </div>

        <h1 className="text-xl font-display font-extrabold text-[var(--text-primary)] mb-2">
          {t("requiredTitle")}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          {t("requiredDesc")}{" "}
          <span className="font-bold text-[var(--accent-orange)]">{seconds}</span>{" "}
          {t("requiredSec")}.
        </p>

        {/* Countdown ring */}
        <div className="relative flex justify-center mb-6">
          <svg width="56" height="56" className="-rotate-90">
            <circle cx="28" cy="28" r="24" fill="none" stroke="var(--border-subtle)" strokeWidth="4" />
            <circle
              cx="28" cy="28" r="24" fill="none"
              stroke="var(--accent-orange)" strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 24}`}
              strokeDashoffset={`${2 * Math.PI * 24 * (1 - seconds / 5)}`}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>
          <span className="absolute top-1/2 -translate-y-1/2 text-lg font-bold font-mono text-[var(--accent-orange)]">
            {seconds}
          </span>
        </div>

        <button
          onClick={goSignIn}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold text-sm hover:opacity-90 transition-opacity"
        >
          <LogIn size={16} /> {t("requiredBtn")}
        </button>

        <button
          onClick={() => router.back()}
          className="mt-3 w-full py-2 rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] font-display text-sm hover:text-[var(--text-primary)] transition-colors"
        >
          {t("requiredBack")}
        </button>
      </div>
    </main>
  );
}
