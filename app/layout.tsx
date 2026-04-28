import type { Metadata, Viewport } from "next";
import "./globals.css";

import { SessionProvider } from "next-auth/react";
import { NextIntlClientProvider } from "next-intl";
import { cookies } from "next/headers";

import { auth } from "@/auth";
import { type Locale, locales } from "@/i18n/config";

import Navbar from "@/components/Navbar";
import BadgeNotifier from "@/components/BadgeNotifier";
import DMNotifier from "@/components/DMNotifier";
import SupportChatBubble from "@/components/SupportChatBubble";
import PwaInit from "@/components/PwaInit";
import { MusicProvider } from "@/contexts/MusicContext";

export const metadata: Metadata = {
  title: "LightHouse — Illuminate Your World",
  description:
    "A premium video platform with global chat, creator subscriptions, and a reward system.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "LightHouse",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "LightHouse",
    description: "Illuminate Your World",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f97316",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
};


export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);

  const raw = cookieStore.get("LOCALE")?.value;
  const locale: Locale = locales.includes(raw as Locale) ? (raw as Locale) : "en";

  const rawTheme = cookieStore.get("THEME")?.value;
  const theme = rawTheme === "pink" ? "pink" : "dark";

  let messages: Record<string, unknown> = {};
  try {
    messages = (await import(`../messages/${locale}.json`)).default;
  } catch {
    messages = (await import(`../messages/en.json`)).default;
  }

  // "meme" is not a valid BCP-47 tag → map to "en" for html lang / Intl APIs
  const intlLocale = locale === "meme" ? "en" : locale;

  return (
    <html lang={intlLocale} data-theme={theme}>
      <body>
        <SessionProvider session={session}>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <MusicProvider>
              <div className="min-h-screen flex flex-col">
                <PwaInit />
                <Navbar />
                <BadgeNotifier />
                <DMNotifier />
                <SupportChatBubble />

                <main className="flex-1">{children}</main>

                <footer className="border-t border-[var(--border-subtle)] py-8 text-center text-[var(--text-muted)] font-[var(--font-body)] text-sm">
                  © {new Date().getFullYear()} LightHouse — All rights reserved.
                </footer>
              </div>
            </MusicProvider>
          </NextIntlClientProvider>
        </SessionProvider>
      </body>
    </html>
  );
}