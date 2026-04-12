import Link from "next/link";
import { Play, MessageSquare, Crown, Star, Zap, ArrowRight, Users, Video, Award } from "lucide-react";

export default function Home() {
  return (
    <div className="overflow-hidden">
      {/* HERO */}
      <section className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center text-center px-6 py-16 relative">
        {/* Background radial glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(249,115,22,0.08)_0%,transparent_70%)] pointer-events-none" />

        {/* Grid lines decoration */}
        <div
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
            maskImage: "radial-gradient(ellipse at center, transparent 30%, black 80%)",
          }}
          className="absolute inset-0 pointer-events-none"
        />

        {/* Badge */}
        <div
          className="animate-in inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-full py-1.5 px-4 mb-8"
          style={{ animationDelay: "0.1s" }}
        >
          <Zap size={13} color="var(--accent-orange)" />
          <span className="font-[var(--font-display)] font-semibold text-[0.8125rem] text-[var(--accent-orange)] tracking-[0.08em] uppercase">
            Now in Beta
          </span>
        </div>

        {/* Headline */}
        <h1
          className="animate-in font-[var(--font-display)] font-extrabold text-[clamp(3rem,8vw,6rem)] leading-none tracking-[-0.04em] max-w-[900px] mb-6"
          style={{ animationDelay: "0.2s" }}
        >
          <span className="text-[var(--text-primary)]">Where great</span>
          <br />
          <span className="gradient-text glow-text">content shines</span>
        </h1>

        <p
          className="animate-in text-[var(--text-secondary)] text-[clamp(1rem,2.5vw,1.25rem)] max-w-[560px] leading-[1.7] mb-12"
          style={{ animationDelay: "0.3s" }}
        >
          LightHouse is your premium video platform — discover creators, join
          a global live chat, climb the rewards ladder, and unlock exclusive
          content with flexible subscriptions.
        </p>

        {/* CTA buttons */}
        <div
          className="animate-in flex gap-4 flex-wrap justify-center"
          style={{ animationDelay: "0.4s" }}
        >
          <Link
            href="/feed"
            className="inline-flex items-center gap-2 bg-[var(--accent-orange)] text-white font-[var(--font-display)] font-bold text-base py-[0.875rem] px-8 rounded-[10px] no-underline transition-all duration-200 shadow-[0_8px_32px_rgba(249,115,22,0.3)]"
          >
            <Play size={18} fill="white" />
            Watch Now
          </Link>
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-2 bg-transparent text-[var(--text-secondary)] font-[var(--font-display)] font-semibold text-base py-[0.875rem] px-8 rounded-[10px] no-underline border border-[var(--border-default)] transition-all duration-200"
          >
            Join Free
            <ArrowRight size={17} />
          </Link>
        </div>

        {/* Stats row */}
        <div
          className="animate-in flex gap-12 flex-wrap justify-center mt-20"
          style={{ animationDelay: "0.5s" }}
        >
          {[
            { icon: Users, value: "50K+", label: "Creators" },
            { icon: Video, value: "2M+",  label: "Videos"  },
            { icon: Star,  value: "4.9",  label: "Rating"  },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Icon size={15} color="var(--accent-orange)" />
                <span className="font-[var(--font-display)] font-extrabold text-[1.75rem] text-[var(--text-primary)]">
                  {value}
                </span>
              </div>
              <span className="text-[var(--text-muted)] text-sm">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-24 px-6 bg-[var(--bg-secondary)]">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-[var(--font-display)] font-extrabold text-[clamp(2rem,4vw,3rem)] tracking-[-0.03em] text-[var(--text-primary)] mb-4">
              Everything you need to{" "}
              <span className="gradient-text">shine</span>
            </h2>
            <p className="text-[var(--text-secondary)] max-w-[500px] mx-auto">
              Built for creators and viewers alike — powerful features wrapped in a beautiful experience.
            </p>
          </div>

          <div style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }} className="grid gap-6">
            {[
              { icon: Play,         title: "Curated Video Feed",     desc: "Discover handpicked content from creators you love. HD and 4K streaming with zero ads on premium plans.",                       accent: "#f97316" },
              { icon: MessageSquare,title: "Global Live Chat",        desc: "Connect with thousands of viewers in real time. Earn badges, level up, and make your voice heard.",                             accent: "#6366f1" },
              { icon: Crown,        title: "Flexible Subscriptions",  desc: "Choose from Basic, Pro, or Elite plans. Unlock premium content, early access, and exclusive perks.",                            accent: "#fbbf24" },
              { icon: Award,        title: "Reward System",           desc: "Earn points for every interaction — watching, commenting, and chatting. Redeem for exclusive rewards.",                          accent: "#10b981" },
            ].map(({ icon: Icon, title, desc, accent }) => (
              <div key={title} className="card lighthouse-beam p-8">
                <div
                  style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                >
                  <Icon size={22} color={accent} />
                </div>
                <h3 className="font-[var(--font-display)] font-bold text-lg mb-2.5 text-[var(--text-primary)]">
                  {title}
                </h3>
                <p className="text-[var(--text-secondary)] text-[0.9375rem] leading-relaxed">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="py-24 px-6">
        <div className="max-w-[900px] mx-auto bg-[linear-gradient(135deg,rgba(249,115,22,0.12),rgba(251,191,36,0.06))] border border-orange-500/20 rounded-[20px] px-16 py-16 text-center relative overflow-hidden lighthouse-beam">
          <h2 className="font-[var(--font-display)] font-extrabold text-[clamp(1.75rem,4vw,2.75rem)] tracking-[-0.03em] mb-4">
            Ready to illuminate your world?
          </h2>
          <p className="text-[var(--text-secondary)] mb-8 text-[1.0625rem]">
            Join over 50,000 creators and viewers on LightHouse today.
          </p>
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-2 bg-[var(--accent-orange)] text-white font-[var(--font-display)] font-bold text-base py-[0.875rem] px-10 rounded-[10px] no-underline shadow-[0_8px_32px_rgba(249,115,22,0.35)] transition-all duration-200"
          >
            Get Started — It&apos;s Free
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}