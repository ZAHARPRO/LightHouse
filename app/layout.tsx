import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/auth";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "LightHouse — Illuminate Your World",
  description:
    "A premium video platform with global chat, creator subscriptions, and a reward system.",
  openGraph: {
    title: "LightHouse",
    description: "Illuminate Your World",
    type: "website",
  },
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
            <Navbar />
            <main className="flex-1">{children}</main>
            <footer
              style={{
                borderTop: "1px solid var(--border-subtle)",
                padding: "2rem",
                textAlign: "center",
                color: "var(--text-muted)",
                fontFamily: "var(--font-body)",
                fontSize: "0.875rem",
              }}
            >
              © {new Date().getFullYear()} LightHouse — All rights reserved.
            </footer>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
