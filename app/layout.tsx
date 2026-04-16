import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/auth";
import Navbar from "@/components/Navbar";
import BadgeNotifier from "@/components/BadgeNotifier";
import SupportChatBubble from "@/components/SupportChatBubble";
import PwaInit from "@/components/PwaInit";

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="en">
      <body>
        <SessionProvider session={session}>
          <div className="min-h-screen flex flex-col">
            <PwaInit />
            <Navbar />
            <BadgeNotifier />
            <SupportChatBubble />
            <main className="flex-1">{children}</main>
            <footer className="border-t border-[var(--border-subtle)] py-8 text-center text-[var(--text-muted)] font-[var(--font-body)] text-sm">
              © {new Date().getFullYear()} LightHouse — All rights reserved.
            </footer>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}