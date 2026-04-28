"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { setLocale } from "@/actions/locale";
import { type Locale, locales, localeNames } from "@/i18n/config";

const FLAGS: Record<Locale, string> = {
  en: "EN",
  uk: "UA",
  meme: "🤡",
};

export default function LanguageSwitcher({ current }: { current: Locale }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  // 🔥 ВОТ ЭТО ФИКС
  const [selected, setSelected] = useState<Locale>(current);

  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  function change(locale: Locale) {
    setOpen(false);
    setSelected(locale); // мгновенно обновили UI

    start(async () => {
      await setLocale(locale);
      router.refresh();
    });
  }

  // синхронизация если сервер поменял
  useEffect(() => {
    setSelected(current);
  }, [current]);

  // клик вне
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative inline-block text-left">
      {/* текущий язык */}
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="px-2 py-1 rounded-lg text-xs font-bold border bg-[var(--bg-elevated)] border-[var(--border-subtle)]"
      >
        {FLAGS[selected]} {/* 👈 теперь не current */}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-28 rounded-xl border bg-[var(--bg-elevated)] border-[var(--border-subtle)] shadow-lg z-50">
          {locales.map((locale) => (
            <button
              key={locale}
              onClick={() => change(locale)}
              disabled={pending || selected === locale}
              title={localeNames[locale]}
              className={[
                "w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors",
                selected === locale
                  ? "opacity-50 cursor-default"
                  : "hover:bg-[var(--bg-hover)]",
              ].join(" ")}
            >
              <span>{FLAGS[locale]}</span>
              <span>{localeNames[locale]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}