"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { subscribeToPlan } from "@/actions/subscriptions";
import { PLANS } from "@/lib/plans";
import { Check, Crown, Zap, Star, Sparkles } from "lucide-react";

type PlanKey = "BASIC" | "PRO" | "ELITE";

const ICONS: Record<PlanKey, React.ReactNode> = {
  BASIC:  <Star size={22} color="#818cf8" />,
  PRO:    <Zap size={22} color="#f97316" />,
  ELITE:  <Crown size={22} color="#fbbf24" />,
};

const ACCENTS: Record<PlanKey, string> = {
  BASIC:  "#818cf8",
  PRO:    "#f97316",
  ELITE:  "#fbbf24",
};

export default function SubscriptionsPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState<PlanKey | null>(null);
  const [success, setSuccess] = useState<PlanKey | null>(null);

  async function handleSubscribe(plan: PlanKey) {
    if (!session) return;
    setLoading(plan);
    const result = await subscribeToPlan(plan);
    if (result.success) setSuccess(plan);
    setLoading(null);
  }

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-16">
      {/* Header */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full py-1.5 px-4 mb-6">
          <Crown size={14} color="var(--accent-orange)" />
          <span className="font-[var(--font-display)] font-semibold text-[0.8125rem] text-[var(--accent-orange)] uppercase tracking-[0.08em]">
            Subscription Plans
          </span>
        </div>
        <h1 className="font-[var(--font-display)] font-extrabold text-[clamp(2.25rem,5vw,3.5rem)] tracking-[-0.04em] leading-none mb-5">
          Choose your <span className="gradient-text">level</span>
        </h1>
        <p className="text-[var(--text-secondary)] max-w-[520px] mx-auto text-[1.0625rem] leading-[1.7]">
          Unlock premium content, exclusive perks, and climb the rewards
          ladder with a plan that fits your style.
        </p>
      </div>

      {/* Plan cards */}
      <div style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }} className="grid gap-6 items-start">
        {(Object.keys(PLANS) as PlanKey[]).map((planKey) => {
          const plan   = PLANS[planKey];
          const accent = ACCENTS[planKey];
          const isPopular = planKey === "PRO";

          return (
            <div
              key={planKey}
              style={{
                border: isPopular ? `2px solid ${accent}` : "1px solid var(--border-subtle)",
                boxShadow: isPopular ? `0 0 40px ${accent}20` : "none",
              }}
              className="bg-[var(--bg-card)] rounded-2xl p-8 relative transition-transform duration-200"
            >
              {isPopular && (
                <div
                  style={{ background: `linear-gradient(90deg, ${accent}, #fbbf24)` }}
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full py-1 px-4 flex items-center gap-1.5"
                >
                  <Sparkles size={12} color="white" />
                  <span className="font-[var(--font-display)] text-[0.75rem] font-bold text-white tracking-[0.05em]">
                    MOST POPULAR
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
                  <h3 className="font-[var(--font-display)] font-extrabold text-[1.25rem] text-[var(--text-primary)]">
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1">
                    <span style={{ color: accent }} className="font-[var(--font-display)] font-extrabold text-[1.875rem]">
                      ${plan.price}
                    </span>
                    <span className="text-[var(--text-muted)] text-sm">/mo</span>
                  </div>
                </div>
              </div>

              {/* Features */}
              <ul className="list-none flex flex-col gap-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5">
                    <div
                      style={{ background: `${accent}18` }}
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                    >
                      <Check size={12} color={accent} strokeWidth={3} />
                    </div>
                    <span className="text-[var(--text-secondary)] text-[0.9rem]">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {session ? (
                <button
                  onClick={() => handleSubscribe(planKey)}
                  disabled={!!loading || success === planKey}
                  style={{
                    background: success === planKey ? `${accent}22` : isPopular ? accent : "transparent",
                    border: `1px solid ${success === planKey ? `${accent}40` : accent}`,
                    color: success === planKey ? accent : isPopular ? "white" : accent,
                    opacity: loading && loading !== planKey ? 0.5 : 1,
                  }}
                  className="w-full font-[var(--font-display)] font-bold text-[0.9375rem] py-3 rounded-[10px] transition-all duration-200 cursor-pointer disabled:cursor-default"
                >
                  {success === planKey ? "✓ Subscribed!" : loading === planKey ? "Processing…" : `Get ${plan.name}`}
                </button>
              ) : (
                <Link
                  href="/auth/register"
                  style={{
                    background: isPopular ? accent : "transparent",
                    border: `1px solid ${accent}`,
                    color: isPopular ? "white" : accent,
                  }}
                  className="block text-center no-underline w-full font-[var(--font-display)] font-bold text-[0.9375rem] py-3 rounded-[10px] transition-all duration-200"
                >
                  Get Started
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* Free tier note */}
      <div className="text-center mt-12 text-[var(--text-muted)] text-sm">
        All plans include a 7-day free trial. Cancel anytime. No hidden fees.
      </div>
    </div>
  );
}