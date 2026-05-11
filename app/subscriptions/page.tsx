"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { subscribeToPlan } from "@/actions/subscriptions";
import { PLANS } from "@/lib/plans";
import {
  Check, Crown, Zap, Star, Sparkles, Gift,
  Download, MessageCircle, ChevronDown, ChevronUp,
  Loader2, Trophy,
} from "lucide-react";
import { useTranslations } from "next-intl";

type PlanKey = "BASIC" | "PRO" | "ELITE";

const ICONS: Record<PlanKey, React.ReactNode> = {
  BASIC: <Star size={22} color="#818cf8" />,
  PRO:   <Zap size={22} color="#f97316" />,
  ELITE: <Crown size={22} color="#fbbf24" />,
};

const ACCENTS: Record<PlanKey, string> = {
  BASIC: "#818cf8",
  PRO:   "#f97316",
  ELITE: "#fbbf24",
};

const TIER_ORDER: Record<string, number> = { FREE: 0, BASIC: 1, PRO: 2, ELITE: 3 };

type ClaimStatus = { tier: string; points: number; monthlyPoints: number; canClaim: boolean; nextClaimAt: string | null };

export default function SubscriptionsPage() {
  const t = useTranslations("subscriptions");
  const { data: session } = useSession();

  const [loading, setLoading]         = useState<PlanKey | null>(null);
  const [success, setSuccess]         = useState<PlanKey | null>(null);
  const [claimStatus, setClaimStatus] = useState<ClaimStatus | null>(null);
  const [claiming, setClaiming]       = useState(false);
  const [claimedPoints, setClaimedPoints] = useState<number | null>(null);
  const [openFaq, setOpenFaq]         = useState<number | null>(null);

  useEffect(() => {
    if (!session) return;
    fetch("/api/rewards/claim-monthly")
      .then(r => r.json())
      .then(setClaimStatus)
      .catch(() => {});
  }, [session]);

  async function handleSubscribe(plan: PlanKey) {
    if (!session) return;
    setLoading(plan);
    const result = await subscribeToPlan(plan);
    if (result.success) {
      setSuccess(plan);
      // refresh claim status
      fetch("/api/rewards/claim-monthly").then(r => r.json()).then(setClaimStatus).catch(() => {});
    }
    setLoading(null);
  }

  async function handleClaim() {
    setClaiming(true);
    const res = await fetch("/api/rewards/claim-monthly", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setClaimedPoints(data.points);
      fetch("/api/rewards/claim-monthly").then(r => r.json()).then(setClaimStatus).catch(() => {});
    }
    setClaiming(false);
  }

  function getNextClaimLabel(): string {
    if (!claimStatus?.nextClaimAt) return t("claimAvailable");
    const diff = new Date(claimStatus.nextClaimAt).getTime() - Date.now();
    if (diff <= 0) return t("claimAvailable");
    const days  = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return t("claimNext", { days, hours });
  }

  const userTier = claimStatus?.tier ?? "FREE";
  const faqs = [
    { q: t("faq1q"), a: t("faq1a") },
    { q: t("faq2q"), a: t("faq2a") },
    { q: t("faq3q"), a: t("faq3a") },
  ];

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-16">

      {/* Header */}
      <div className="text-center mb-14">
        <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full py-1.5 px-4 mb-6">
          <Crown size={14} color="var(--accent-orange)" />
          <span className="font-display font-semibold text-[0.8125rem] text-[var(--accent-orange)] uppercase tracking-[0.08em]">
            {t("badge")}
          </span>
        </div>
        <h1 className="font-display font-extrabold text-[clamp(2.25rem,5vw,3.5rem)] tracking-[-0.04em] leading-none mb-5">
          {t("title")}
        </h1>
        <p className="text-[var(--text-secondary)] max-w-[520px] mx-auto text-[1.0625rem] leading-[1.7]">
          {t("subtitle")}
        </p>

        {/* Current plan badge */}
        {session && claimStatus && userTier !== "FREE" && (
          <div className="inline-flex items-center gap-2 mt-6 px-4 py-2 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
            <span className="text-xs text-[var(--text-muted)]">{t("currentPlan")}:</span>
            <span
              className="text-xs font-display font-bold"
              style={{ color: ACCENTS[userTier as PlanKey] ?? "#888" }}
            >
              {userTier}
            </span>
          </div>
        )}
      </div>

      {/* Monthly reward claim card */}
      {session && claimStatus && claimStatus.monthlyPoints > 0 && (
        <div className="mb-10 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
            <Gift size={22} color="var(--accent-orange)" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-[var(--text-primary)] mb-0.5">
              {t("monthlyRewards")}
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              {claimedPoints
                ? t("claimed", { points: claimedPoints })
                : getNextClaimLabel()}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-1">
              <Trophy size={11} />
              {t("totalPoints", { points: claimStatus.points })}
            </p>
          </div>
          <button
            onClick={handleClaim}
            disabled={!claimStatus.canClaim || claiming || !!claimedPoints}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent-orange)] text-white font-display font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0"
          >
            {claiming
              ? <><Loader2 size={14} className="animate-spin" /> {t("claiming")}</>
              : t("claimPoints", { points: claimStatus.monthlyPoints })}
          </button>
        </div>
      )}

      {/* Plan cards */}
      <div
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}
        className="grid gap-6 items-start mb-16"
      >
        {(Object.keys(PLANS) as PlanKey[]).map((planKey) => {
          const plan      = PLANS[planKey];
          const accent    = ACCENTS[planKey];
          const isPopular = planKey === "PRO";
          const isCurrent = userTier === planKey;
          const isBelow   = TIER_ORDER[userTier] > TIER_ORDER[planKey];

          return (
            <div
              key={planKey}
              style={{
                border: isCurrent
                  ? `2px solid ${accent}`
                  : isPopular
                  ? `2px solid ${accent}`
                  : "1px solid var(--border-subtle)",
                boxShadow: isCurrent || isPopular ? `0 0 40px ${accent}20` : "none",
              }}
              className="bg-[var(--bg-card)] rounded-2xl p-8 relative transition-all duration-200 hover:-translate-y-0.5"
            >
              {isCurrent && (
                <div
                  style={{ background: `linear-gradient(90deg, ${accent}, ${accent}99)` }}
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full py-1 px-4 flex items-center gap-1.5"
                >
                  <Check size={12} color="white" />
                  <span className="font-display text-[0.75rem] font-bold text-white tracking-[0.05em]">
                    {t("currentPlan")}
                  </span>
                </div>
              )}
              {isPopular && !isCurrent && (
                <div
                  style={{ background: `linear-gradient(90deg, ${accent}, #fbbf24)` }}
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full py-1 px-4 flex items-center gap-1.5"
                >
                  <Sparkles size={12} color="white" />
                  <span className="font-display text-[0.75rem] font-bold text-white tracking-[0.05em]">
                    {t("mostPopular")}
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div className="flex items-center gap-3 mb-6">
                <div
                  style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                >
                  {ICONS[planKey]}
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-[1.25rem] text-[var(--text-primary)]">
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1">
                    <span style={{ color: accent }} className="font-display font-extrabold text-[1.875rem]">
                      ${plan.price}
                    </span>
                    <span className="text-[var(--text-muted)] text-sm">{t("perMonth")}</span>
                  </div>
                </div>
              </div>

              {/* Features */}
              <ul className="list-none flex flex-col gap-3 mb-8">
                {plan.features.map((feature) => {
                  const isDownload = feature.toLowerCase().includes("download");
                  const isDm       = feature.toLowerCase().includes("creator messaging");
                  return (
                    <li key={feature} className="flex items-center gap-2.5">
                      <div
                        style={{ background: `${accent}18` }}
                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      >
                        {isDownload ? (
                          <Download size={10} color={accent} strokeWidth={3} />
                        ) : isDm ? (
                          <MessageCircle size={10} color={accent} strokeWidth={3} />
                        ) : (
                          <Check size={12} color={accent} strokeWidth={3} />
                        )}
                      </div>
                      <span className="text-[var(--text-secondary)] text-[0.9rem]">{feature}</span>
                    </li>
                  );
                })}
              </ul>

              {/* CTA */}
              {session ? (
                <button
                  onClick={() => handleSubscribe(planKey)}
                  disabled={!!loading || success === planKey || isCurrent || isBelow}
                  style={{
                    background: isCurrent
                      ? `${accent}15`
                      : success === planKey
                      ? `${accent}22`
                      : isPopular
                      ? accent
                      : "transparent",
                    border: `1px solid ${success === planKey || isCurrent ? `${accent}40` : accent}`,
                    color: isCurrent
                      ? accent
                      : success === planKey
                      ? accent
                      : isPopular
                      ? "white"
                      : accent,
                    opacity: (loading && loading !== planKey) || isBelow ? 0.4 : 1,
                  }}
                  className="w-full font-display font-bold text-[0.9375rem] py-3 rounded-[10px] transition-all duration-200 cursor-pointer disabled:cursor-default"
                >
                  {isCurrent
                    ? `✓ ${t("currentPlan")}`
                    : success === planKey
                    ? t("subscribedPlan")
                    : loading === planKey
                    ? t("processing")
                    : isBelow
                    ? plan.name
                    : t("getPlan", { name: plan.name })}
                </button>
              ) : (
                <Link
                  href="/auth/register"
                  style={{
                    background: isPopular ? accent : "transparent",
                    border: `1px solid ${accent}`,
                    color: isPopular ? "white" : accent,
                  }}
                  className="block text-center no-underline w-full font-display font-bold text-[0.9375rem] py-3 rounded-[10px] transition-all duration-200"
                >
                  {t("getStarted")}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* Feature highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-16">
        {[
          { icon: <Download size={20} color="#f97316" />, bg: "#f9731618", label: "Download Videos", desc: "Save any video for offline. Pro & Elite only.", accent: "#f97316" },
          { icon: <Gift size={20} color="#a78bfa" />, bg: "#a78bfa18", label: "Monthly Points", desc: "Pro: 50 pts/mo. Elite: 150 pts/mo. Auto-claimable.", accent: "#a78bfa" },
          { icon: <MessageCircle size={20} color="#fbbf24" />, bg: "#fbbf2418", label: "Creator DMs", desc: "Message any creator directly. Elite exclusive.", accent: "#fbbf24" },
        ].map(({ icon, bg, label, desc, accent }) => (
          <div key={label} className="flex gap-3 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: bg }}>
              {icon}
            </div>
            <div>
              <p className="font-display font-bold text-sm text-[var(--text-primary)] mb-0.5" style={{ color: accent }}>{label}</p>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto mb-12">
        <h2 className="font-display font-extrabold text-xl text-[var(--text-primary)] mb-6 text-center">
          {t("faqTitle")}
        </h2>
        <div className="flex flex-col gap-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="border border-[var(--border-subtle)] rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left font-display font-semibold text-sm text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                {faq.q}
                {openFaq === i
                  ? <ChevronUp size={16} className="text-[var(--text-muted)] shrink-0" />
                  : <ChevronDown size={16} className="text-[var(--text-muted)] shrink-0" />}
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4 text-sm text-[var(--text-muted)] leading-relaxed border-t border-[var(--border-subtle)]">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer note */}
      <div className="text-center text-[var(--text-muted)] text-sm">
        {t("freeTrial")}
      </div>
    </div>
  );
}
