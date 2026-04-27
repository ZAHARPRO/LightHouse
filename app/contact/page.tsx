"use client";

import { useState } from "react";
import { sendContactMessage } from "@/actions/contact";
import { Mail, MessageSquare, Github, CheckCircle, Zap } from "lucide-react";
import { useTranslations } from "next-intl";

export default function ContactPage() {
  const t = useTranslations("contact");
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

  const INFO_CARDS = [
    { icon: Mail,        title: t("emailSupport"),     desc: "support@lighthouse.io",              accent: "#f97316" },
    { icon: MessageSquare, title: t("communityDiscord"), desc: "discord.gg/lighthouse",             accent: "#6366f1" },
    { icon: Github,      title: t("githubIssues"),     desc: "github.com/ZAHARPRO/LightHouse",     accent: "#888" },
  ];

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-16">
      {/* Header */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 bg-orange-500/[0.08] border border-orange-500/20 rounded-full py-1.5 px-4 mb-6">
          <Mail size={14} color="var(--accent-orange)" />
          <span className="font-display font-semibold text-[0.8125rem] text-[var(--accent-orange)] uppercase tracking-[0.08em]">
            {t("getInTouch")}
          </span>
        </div>
        <h1 className="font-display font-extrabold text-[clamp(2rem,4vw,3rem)] tracking-[-0.04em] mb-4">
          {t("title")}
        </h1>
        <p className="text-[var(--text-secondary)] max-w-[480px] mx-auto leading-[1.7]">
          {t("subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-12 items-start">
        {/* Left: info cards */}
        <div className="flex flex-col gap-5">
          {INFO_CARDS.map(({ icon: Icon, title, desc, accent }) => (
            <div key={title} className="card flex gap-4 items-center px-6 py-5">
              <div
                style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}
                className="w-11 h-11 rounded-[10px] flex items-center justify-center shrink-0"
              >
                <Icon size={20} color={accent} />
              </div>
              <div>
                <p className="font-display font-bold text-[0.9rem] text-[var(--text-primary)] mb-0.5">{title}</p>
                <p className="text-[var(--text-secondary)] text-[0.8125rem]">{desc}</p>
              </div>
            </div>
          ))}

          <div className="mt-2 p-6 bg-[linear-gradient(135deg,rgba(249,115,22,0.08),rgba(251,191,36,0.04))] border border-orange-500/15 rounded-xl">
            <div className="flex gap-2 items-center mb-2.5">
              <Zap size={16} color="var(--accent-orange)" />
              <span className="font-display font-bold text-[0.875rem]">{t("responseTime")}</span>
            </div>
            <p className="text-[var(--text-secondary)] text-[0.875rem] leading-relaxed">
              {t("responseTimeDesc")}
            </p>
          </div>
        </div>

        {/* Right: form */}
        <div className="card p-10">
          {status === "success" ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle size={32} color="#10b981" />
              </div>
              <h3 className="font-display font-extrabold text-2xl mb-2.5">
                {t("successTitle")}
              </h3>
              <p className="text-[var(--text-secondary)]">
                {t("successMessage")}
              </p>
              <button
                onClick={() => setStatus("idle")}
                className="btn-ghost mt-6"
              >
                {t("sendAnother")}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-sm mb-1.5 text-[var(--text-secondary)]">
                    {t("nameLabel")}
                  </label>
                  <input name="name" type="text" placeholder={t("namePlaceholder")} required className="input-field" />
                </div>
                <div>
                  <label className="block font-medium text-sm mb-1.5 text-[var(--text-secondary)]">
                    {t("emailLabel")}
                  </label>
                  <input name="email" type="email" placeholder="you@example.com" required className="input-field" />
                </div>
              </div>

              <div>
                <label className="block font-medium text-sm mb-1.5 text-[var(--text-secondary)]">
                  {t("subjectLabel")}
                </label>
                <select name="subject" required className="input-field">
                  <option value="">{t("subjectPlaceholder")}</option>
                  <option value="General question">{t("subjectGeneral")}</option>
                  <option value="Bug report">{t("subjectBug")}</option>
                  <option value="Partnership">{t("subjectPartnership")}</option>
                  <option value="Feature request">{t("subjectFeature")}</option>
                  <option value="Billing & subscription">{t("subjectBilling")}</option>
                  <option value="Creator support">{t("subjectCreator")}</option>
                  <option value="Other">{t("subjectOther")}</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-sm mb-1.5 text-[var(--text-secondary)]">
                  {t("messageLabel")}
                </label>
                <textarea
                  name="message"
                  placeholder={t("messagePlaceholder")}
                  required
                  rows={5}
                  className="input-field resize-y min-h-[120px]"
                />
              </div>

              {status === "error" && (
                <p className="text-red-500 text-sm px-3 py-2 bg-red-500/[0.08] rounded-md">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                className="btn-primary self-start px-8"
                disabled={status === "loading"}
              >
                {status === "loading" ? t("sending") : t("send")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
