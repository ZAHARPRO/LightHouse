"use client";
import { createContext, useContext } from "react";
import { type Locale } from "@/i18n/config";

const LocaleCtx = createContext<Locale>("en");

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleCtx.Provider value={locale}>{children}</LocaleCtx.Provider>;
}

export function useRawLocale(): Locale {
  return useContext(LocaleCtx);
}
