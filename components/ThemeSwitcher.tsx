"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { setTheme } from "@/actions/theme";

type Theme = "dark" | "pink";

const THEMES: { value: Theme; icon: string; label: string }[] = [
  { value: "dark", icon: "🌑", label: "Dark"      },
  { value: "pink", icon: "🌸", label: "Pink"      },
];

function readThemeCookie(): Theme {
  if (typeof document === "undefined") return "dark";
  const m = document.cookie.match(/(?:^|;\s*)THEME=([^;]+)/);
  return m?.[1] === "pink" ? "pink" : "dark";
}

export default function ThemeSwitcher() {
  const [pending, start] = useTransition();
  const [open, setOpen]       = useState(false);
  const [selected, setSelected] = useState<Theme>("dark");
  const router = useRouter();
  const ref    = useRef<HTMLDivElement>(null);

  // Sync from cookie on mount (SSR renders "dark", client corrects if needed)
  useEffect(() => { setSelected(readThemeCookie()); }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function change(theme: Theme) {
    setOpen(false);
    setSelected(theme);
    // Instantly update data-theme so the UI flips without waiting for server
    document.documentElement.setAttribute("data-theme", theme);
    start(async () => {
      await setTheme(theme);
      router.refresh();
    });
  }

  const current_theme = THEMES.find((t) => t.value === selected) ?? THEMES[0];

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        title="Color scheme"
        className="px-2 py-1 rounded-lg text-xs font-bold border bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-default)] transition-colors"
      >
        {current_theme.icon}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-32 rounded-xl border bg-[var(--bg-elevated)] border-[var(--border-subtle)] shadow-lg z-50 overflow-hidden">
          {THEMES.map((t) => (
            <button
              key={t.value}
              onClick={() => change(t.value)}
              disabled={pending || selected === t.value}
              className={[
                "w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors",
                selected === t.value
                  ? "opacity-50 cursor-default"
                  : "hover:bg-[var(--bg-hover)]",
              ].join(" ")}
            >
              <span>{t.icon}</span>
              <span className="text-[var(--text-secondary)]">{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
