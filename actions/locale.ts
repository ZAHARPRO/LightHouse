"use server";

import { cookies } from "next/headers";
import { type Locale, locales } from "@/i18n/config";

export async function setLocale(locale: Locale) {
  if (!locales.includes(locale)) return;

  const store = await cookies();

  store.set("LOCALE", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}