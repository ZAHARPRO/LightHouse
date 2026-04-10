"use client";

import { useState } from "react";
import { sendContactMessage } from "@/actions/contact";
import { Mail, MessageSquare, Github, CheckCircle, Zap } from "lucide-react";

export default function ContactPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    const formData = new FormData(e.currentTarget);
    const result = await sendContactMessage(formData);
    if (result.success) {
      setStatus("success");
      (e.target as HTMLFormElement).reset();
    } else {
      setStatus("error");
      setErrorMsg(result.error ?? "Something went wrong.");
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "4rem 1.5rem" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "4rem" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 100, padding: "0.375rem 1rem", marginBottom: "1.5rem" }}>
          <Mail size={14} color="var(--accent-orange)" />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.8125rem", color: "var(--accent-orange)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Get in Touch
          </span>
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.04em", marginBottom: "1rem" }}>
          We&apos;d love to <span className="gradient-text">hear from you</span>
        </h1>
        <p style={{ color: "var(--text-secondary)", maxWidth: 480, margin: "0 auto", lineHeight: 1.7 }}>
          Have a question, idea, or partnership proposal? Drop us a message
          and we&apos;ll get back to you within 24 hours.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "3rem", alignItems: "start" }}>
        {/* Left: info cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {[
            { icon: Mail, title: "Email Support", desc: "support@lighthouse.io", accent: "#f97316" },
            { icon: MessageSquare, title: "Community Discord", desc: "discord.gg/lighthouse", accent: "#6366f1" },
            { icon: Github, title: "GitHub Issues", desc: "github.com/ZAHARPRO/LightHouse", accent: "#888" },
          ].map(({ icon: Icon, title, desc, accent }) => (
            <div key={title} className="card" style={{ padding: "1.25rem 1.5rem", display: "flex", gap: "1rem", alignItems: "center" }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: `${accent}18`, border: `1px solid ${accent}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={20} color={accent} />
              </div>
              <div>
                <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)", marginBottom: "0.125rem" }}>{title}</p>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.8125rem" }}>{desc}</p>
              </div>
            </div>
          ))}

          <div style={{ marginTop: "0.5rem", padding: "1.5rem", background: "linear-gradient(135deg, rgba(249,115,22,0.08), rgba(251,191,36,0.04))", border: "1px solid rgba(249,115,22,0.15)", borderRadius: 12 }}>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.625rem" }}>
              <Zap size={16} color="var(--accent-orange)" />
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.875rem" }}>Response time</span>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.6 }}>
              We typically respond to all messages within <strong style={{ color: "var(--accent-orange)" }}>24 hours</strong> on business days.
            </p>
          </div>
        </div>

        {/* Right: form */}
        <div className="card" style={{ padding: "2.5rem" }}>
          {status === "success" ? (
            <div style={{ textAlign: "center", padding: "2rem 0" }}>
              <div style={{ width: 64, height: 64, background: "rgba(16,185,129,0.1)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}>
                <CheckCircle size={32} color="#10b981" />
              </div>
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.5rem", marginBottom: "0.625rem" }}>
                Message sent!
              </h3>
              <p style={{ color: "var(--text-secondary)" }}>
                Thanks for reaching out. We&apos;ll get back to you within 24 hours.
              </p>
              <button
                onClick={() => setStatus("idle")}
                className="btn-ghost"
                style={{ marginTop: "1.5rem" }}
              >
                Send Another
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontWeight: 500, fontSize: "0.875rem", marginBottom: "0.375rem", color: "var(--text-secondary)" }}>
                    Name *
                  </label>
                  <input name="name" type="text" placeholder="Your name" required className="input-field" />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 500, fontSize: "0.875rem", marginBottom: "0.375rem", color: "var(--text-secondary)" }}>
                    Email *
                  </label>
                  <input name="email" type="email" placeholder="you@example.com" required className="input-field" />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 500, fontSize: "0.875rem", marginBottom: "0.375rem", color: "var(--text-secondary)" }}>
                  Subject *
                </label>
                <select name="subject" required className="input-field">
                  <option value="">Choose a subject…</option>
                  <option value="General question">General question</option>
                  <option value="Bug report">Bug report</option>
                  <option value="Partnership">Partnership</option>
                  <option value="Feature request">Feature request</option>
                  <option value="Billing & subscription">Billing & subscription</option>
                  <option value="Creator support">Creator support</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 500, fontSize: "0.875rem", marginBottom: "0.375rem", color: "var(--text-secondary)" }}>
                  Message *
                </label>
                <textarea
                  name="message"
                  placeholder="Tell us what's on your mind…"
                  required
                  rows={5}
                  className="input-field"
                  style={{ resize: "vertical", minHeight: 120 }}
                />
              </div>

              {status === "error" && (
                <p style={{ color: "#ef4444", fontSize: "0.875rem", padding: "0.5rem 0.75rem", background: "rgba(239,68,68,0.08)", borderRadius: 6 }}>
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                className="btn-primary"
                disabled={status === "loading"}
                style={{ alignSelf: "flex-start", paddingLeft: "2rem", paddingRight: "2rem" }}
              >
                {status === "loading" ? "Sending…" : "Send Message"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
