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
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "4rem 1.5rem" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "4rem" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 100, padding: "0.375rem 1rem", marginBottom: "1.5rem" }}>
          <Crown size={14} color="var(--accent-orange)" />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.8125rem", color: "var(--accent-orange)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Subscription Plans
          </span>
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(2.25rem, 5vw, 3.5rem)", letterSpacing: "-0.04em", lineHeight: 1, marginBottom: "1.25rem" }}>
          Choose your <span className="gradient-text">level</span>
        </h1>
        <p style={{ color: "var(--text-secondary)", maxWidth: 520, margin: "0 auto", fontSize: "1.0625rem", lineHeight: 1.7 }}>
          Unlock premium content, exclusive perks, and climb the rewards
          ladder with a plan that fits your style.
        </p>
      </div>

      {/* Plan cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem", alignItems: "start" }}>
        {(Object.keys(PLANS) as PlanKey[]).map((planKey) => {
          const plan = PLANS[planKey];
          const accent = ACCENTS[planKey];
          const isPopular = planKey === "PRO";

          return (
            <div
              key={planKey}
              style={{
                background: "var(--bg-card)",
                border: isPopular ? `2px solid ${accent}` : "1px solid var(--border-subtle)",
                borderRadius: 16,
                padding: "2rem",
                position: "relative",
                transition: "transform 0.2s, box-shadow 0.2s",
                boxShadow: isPopular ? `0 0 40px ${accent}20` : "none",
              }}
            >
              {isPopular && (
                <div
                  style={{
                    position: "absolute",
                    top: -14,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: `linear-gradient(90deg, ${accent}, #fbbf24)`,
                    borderRadius: 100,
                    padding: "0.25rem 1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                  }}
                >
                  <Sparkles size={12} color="white" />
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", fontWeight: 700, color: "white", letterSpacing: "0.05em" }}>
                    MOST POPULAR
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: `${accent}18`, border: `1px solid ${accent}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {ICONS[planKey]}
                </div>
                <div>
                  <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.25rem", color: "var(--text-primary)" }}>
                    {plan.name}
                  </h3>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "0.25rem" }}>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.875rem", color: accent }}>
                      ${plan.price}
                    </span>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>/mo</span>
                  </div>
                </div>
              </div>

              {/* Features */}
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "2rem" }}>
                {plan.features.map((feature) => (
                  <li key={feature} style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Check size={12} color={accent} strokeWidth={3} />
                    </div>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {session ? (
                <button
                  onClick={() => handleSubscribe(planKey)}
                  disabled={!!loading || success === planKey}
                  style={{
                    width: "100%",
                    background: success === planKey ? `${accent}22` : isPopular ? accent : "transparent",
                    border: `1px solid ${success === planKey ? `${accent}40` : accent}`,
                    color: success === planKey ? accent : isPopular ? "white" : accent,
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: "0.9375rem",
                    padding: "0.75rem",
                    borderRadius: 10,
                    cursor: loading || success === planKey ? "default" : "pointer",
                    transition: "all 0.2s",
                    opacity: loading && loading !== planKey ? 0.5 : 1,
                  }}
                >
                  {success === planKey ? "✓ Subscribed!" : loading === planKey ? "Processing…" : `Get ${plan.name}`}
                </button>
              ) : (
                <Link
                  href="/auth/register"
                  style={{
                    display: "block",
                    textAlign: "center",
                    textDecoration: "none",
                    width: "100%",
                    background: isPopular ? accent : "transparent",
                    border: `1px solid ${accent}`,
                    color: isPopular ? "white" : accent,
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: "0.9375rem",
                    padding: "0.75rem",
                    borderRadius: 10,
                    transition: "all 0.2s",
                  }}
                >
                  Get Started
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* Free tier note */}
      <div style={{ textAlign: "center", marginTop: "3rem", color: "var(--text-muted)", fontSize: "0.875rem" }}>
        All plans include a 7-day free trial. Cancel anytime. No hidden fees.
      </div>
    </div>
  );
}
