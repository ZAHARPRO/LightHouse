import type { ReactNode } from "react";

export const metadata = { title: "Stream Overlay" };

export default function OverlayLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: "transparent", overflow: "hidden" }}>
        {children}
      </body>
    </html>
  );
}
