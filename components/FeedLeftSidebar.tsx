"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";

type Sub = { id: string; name: string; initials: string; color: string; image?: string | null };

interface Props {
  subs: Sub[];
  chatOpen: boolean;
  onChatToggle: () => void;
  onExpandedChange?: (expanded: boolean) => void;
}

export default function FeedLeftSidebar({ subs, chatOpen, onChatToggle, onExpandedChange }: Props) {
  const t = useTranslations("feed");
  const tc = useTranslations("common");
  const [expanded, setExpanded] = useState(false);

  function handleMouseEnter() {
    setExpanded(true);
    onExpandedChange?.(true);
  }

  function handleMouseLeave() {
    setExpanded(false);
    onExpandedChange?.(false);
  }

  const w = expanded ? 130 : 52;

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="flex flex-col gap-4 overflow-y-auto overflow-x-hidden sticky"
      style={{
        width: w,
        transition: "width 0.3s ease",
        top: "calc(64px + 1.5rem)",
        maxHeight: "calc(100vh - 64px - 3rem)",
      }}
    >
      {/* Chat button */}
      <button
        onClick={onChatToggle}
        className="sidebar-chat-link flex flex-col items-center cursor-pointer overflow-hidden w-full rounded-xl border transition-[border-color,background] duration-200"
        style={{
          gap: expanded ? "0.5rem" : 0,
          padding: expanded ? "0.75rem 0.5rem" : "0.5rem",
          background: chatOpen ? "rgba(249,115,22,0.08)" : "var(--bg-card)",
          borderColor: chatOpen ? "rgba(249,115,22,0.35)" : "var(--border-subtle)",
          transition: "border-color 0.2s, background 0.2s, padding 0.3s ease, gap 0.3s ease",
        }}
      >
        <div
          className="rounded-full flex items-center justify-center shrink-0 border-2 border-pink-500/30"
          style={{
            width: expanded ? 52 : 34,
            height: expanded ? 52 : 34,
            background: chatOpen ? "rgba(249,115,22,0.2)" : "rgba(249,115,22,0.12)",
            transition: "width 0.3s ease, height 0.3s ease, background 0.2s",
          }}
        >
          <MessageSquare size={expanded ? 22 : 15} className="text-[var(--accent-orange)]" />
        </div>
        <span
          className="font-display font-bold text-xs tracking-[0.05em] uppercase overflow-hidden whitespace-nowrap"
          style={{
            color: chatOpen ? "var(--accent-orange)" : "var(--text-secondary)",
            maxHeight: expanded ? 24 : 0,
            opacity: expanded ? 1 : 0,
            transition: "max-height 0.3s ease, opacity 0.3s ease, color 0.2s",
          }}
        >
          {chatOpen ? tc("close") : t("theChat")}
        </span>
      </button>

      {/* Subscriptions */}
      {subs.length > 0 && (
        <div>
          <p
            className="font-display font-bold text-[0.7rem] text-[var(--text-muted)] tracking-[0.08em] uppercase mb-2 pl-1 overflow-hidden whitespace-nowrap"
            style={{
              maxHeight: expanded ? 24 : 0,
              opacity: expanded ? 1 : 0,
              transition: "max-height 0.3s ease, opacity 0.25s ease",
            }}
          >
            {t("subscriptions")}
          </p>
          <div className="flex flex-col gap-[0.375rem]">
            {subs.map((sub) => (
              <Link
                key={sub.id}
                href={`/profile/${sub.id}`}
                className="sidebar-sub-link flex items-center px-[0.25rem] py-[0.3rem] rounded-lg no-underline overflow-hidden"
                style={{
                  gap: expanded ? "0.625rem" : 0,
                  transition: "background 0.15s, gap 0.3s ease",
                }}
              >
                <div
                  className="w-[40px] h-[40px] rounded-full shrink-0 overflow-hidden flex items-center justify-center text-[0.6875rem] font-bold font-display"
                  style={
                    sub.image
                      ? { border: `1.5px solid ${sub.color}50` }
                      : { background: `${sub.color}22`, border: `1.5px solid ${sub.color}50`, color: sub.color }
                  }
                >
                  {sub.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sub.image} alt={sub.name} className="w-full h-full object-cover" />
                  ) : (
                    sub.initials
                  )}
                </div>
                <span
                  className="font-body text-xs text-[var(--text-secondary)] whitespace-nowrap overflow-hidden"
                  style={{
                    maxWidth: expanded ? 90 : 0,
                    opacity: expanded ? 1 : 0,
                    transition: "max-width 0.3s ease, opacity 0.25s ease",
                  }}
                >
                  {sub.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
