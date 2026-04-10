import Link from "next/link";
import { Play, MessageSquare, Crown, Star, Zap, ArrowRight, Users, Video, Award } from "lucide-react";

export default function Home() {
  return (
    <div style={{ overflow: "hidden" }}>
      {/* HERO */}
      <section
        style={{
          minHeight: "calc(100vh - 64px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "4rem 1.5rem",
          position: "relative",
        }}
      >
        {/* Background radial glow */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -60%)",
            width: 800,
            height: 800,
            background: "radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Grid lines decoration */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
            maskImage: "radial-gradient(ellipse at center, transparent 30%, black 80%)",
            pointerEvents: "none",
          }}
        />

        {/* Badge */}
        <div
          className="animate-in"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "rgba(249,115,22,0.1)",
            border: "1px solid rgba(249,115,22,0.3)",
            borderRadius: 100,
            padding: "0.375rem 1rem",
            marginBottom: "2rem",
            animationDelay: "0.1s",
          }}
        >
          <Zap size={13} color="var(--accent-orange)" />
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: "0.8125rem",
              color: "var(--accent-orange)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Now in Beta
          </span>
        </div>

        {/* Headline */}
        <h1
          className="animate-in"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: "clamp(3rem, 8vw, 6rem)",
            lineHeight: 1.0,
            letterSpacing: "-0.04em",
            maxWidth: 900,
            marginBottom: "1.5rem",
            animationDelay: "0.2s",
          }}
        >
          <span style={{ color: "var(--text-primary)" }}>Where great</span>
          <br />
          <span className="gradient-text glow-text">content shines</span>
        </h1>

        <p
          className="animate-in"
          style={{
            color: "var(--text-secondary)",
            fontSize: "clamp(1rem, 2.5vw, 1.25rem)",
            maxWidth: 560,
            lineHeight: 1.7,
            marginBottom: "3rem",
            animationDelay: "0.3s",
          }}
        >
          LightHouse is your premium video platform — discover creators, join
          a global live chat, climb the rewards ladder, and unlock exclusive
          content with flexible subscriptions.
        </p>

        {/* CTA buttons */}
        <div
          className="animate-in"
          style={{
            display: "flex",
            gap: "1rem",
            flexWrap: "wrap",
            justifyContent: "center",
            animationDelay: "0.4s",
          }}
        >
          <Link
            href="/feed"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "var(--accent-orange)",
              color: "white",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "1rem",
              padding: "0.875rem 2rem",
              borderRadius: 10,
              textDecoration: "none",
              transition: "all 0.2s",
              boxShadow: "0 8px 32px rgba(249,115,22,0.3)",
            }}
          >
            <Play size={18} fill="white" />
            Watch Now
          </Link>
          <Link
            href="/auth/register"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "transparent",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: "1rem",
              padding: "0.875rem 2rem",
              borderRadius: 10,
              textDecoration: "none",
              border: "1px solid var(--border-default)",
              transition: "all 0.2s",
            }}
          >
            Join Free
            <ArrowRight size={17} />
          </Link>
        </div>

        {/* Stats row */}
        <div
          className="animate-in"
          style={{
            display: "flex",
            gap: "3rem",
            flexWrap: "wrap",
            justifyContent: "center",
            marginTop: "5rem",
            animationDelay: "0.5s",
          }}
        >
          {[
            { icon: Users, value: "50K+", label: "Creators" },
            { icon: Video, value: "2M+", label: "Videos" },
            { icon: Star, value: "4.9", label: "Rating" },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.375rem",
                  marginBottom: "0.25rem",
                }}
              >
                <Icon size={15} color="var(--accent-orange)" />
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize: "1.75rem",
                    color: "var(--text-primary)",
                  }}
                >
                  {value}
                </span>
              </div>
              <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: "6rem 1.5rem", background: "var(--bg-secondary)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "4rem" }}>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: "clamp(2rem, 4vw, 3rem)",
                letterSpacing: "-0.03em",
                color: "var(--text-primary)",
                marginBottom: "1rem",
              }}
            >
              Everything you need to{" "}
              <span className="gradient-text">shine</span>
            </h2>
            <p style={{ color: "var(--text-secondary)", maxWidth: 500, margin: "0 auto" }}>
              Built for creators and viewers alike — powerful features wrapped in a beautiful experience.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {[
              {
                icon: Play,
                title: "Curated Video Feed",
                desc: "Discover handpicked content from creators you love. HD and 4K streaming with zero ads on premium plans.",
                accent: "#f97316",
              },
              {
                icon: MessageSquare,
                title: "Global Live Chat",
                desc: "Connect with thousands of viewers in real time. Earn badges, level up, and make your voice heard.",
                accent: "#6366f1",
              },
              {
                icon: Crown,
                title: "Flexible Subscriptions",
                desc: "Choose from Basic, Pro, or Elite plans. Unlock premium content, early access, and exclusive perks.",
                accent: "#fbbf24",
              },
              {
                icon: Award,
                title: "Reward System",
                desc: "Earn points for every interaction — watching, commenting, and chatting. Redeem for exclusive rewards.",
                accent: "#10b981",
              },
            ].map(({ icon: Icon, title, desc, accent }) => (
              <div
                key={title}
                className="card lighthouse-beam"
                style={{ padding: "2rem" }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: `${accent}18`,
                    border: `1px solid ${accent}30`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "1.25rem",
                  }}
                >
                  <Icon size={22} color={accent} />
                </div>
                <h3
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: "1.125rem",
                    marginBottom: "0.625rem",
                    color: "var(--text-primary)",
                  }}
                >
                  {title}
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem", lineHeight: 1.6 }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section style={{ padding: "6rem 1.5rem" }}>
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            background: "linear-gradient(135deg, rgba(249,115,22,0.12), rgba(251,191,36,0.06))",
            border: "1px solid rgba(249,115,22,0.2)",
            borderRadius: 20,
            padding: "4rem",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
          className="lighthouse-beam"
        >
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
              letterSpacing: "-0.03em",
              marginBottom: "1rem",
            }}
          >
            Ready to illuminate your world?
          </h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "2rem", fontSize: "1.0625rem" }}>
            Join over 50,000 creators and viewers on LightHouse today.
          </p>
          <Link
            href="/auth/register"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "var(--accent-orange)",
              color: "white",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "1rem",
              padding: "0.875rem 2.5rem",
              borderRadius: 10,
              textDecoration: "none",
              boxShadow: "0 8px 32px rgba(249,115,22,0.35)",
              transition: "all 0.2s",
            }}
          >
            Get Started — It&apos;s Free
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
