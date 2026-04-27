import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { type Locale, locales, defaultLocale } from "./config";

export type { Locale };
export { locales, defaultLocale };

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get("LOCALE")?.value;
  const locale: Locale = locales.includes(raw as Locale)
    ? (raw as Locale)
    : defaultLocale;

  return {
    locale: locale === "meme" ? "en" : locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
