import type { ReactNode } from "react";

export const metadata = { title: "Stream Overlay" };

export default function OverlayLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Hide all root-layout chrome (Navbar, footer, notification hub, etc.)
          and force body/html to be transparent so screen-capture chroma key works */}
      <style>{`
        html, body { background: transparent !important; overflow: hidden !important; }
        body > div > nav,
        body > div > footer,
        body > div > [class*="Navbar"],
        body > div > [class*="Support"],
        body > div > [class*="Notification"],
        body > div > [class*="PwaInit"] { display: none !important; }
        body > div { min-height: 0 !important; background: transparent !important; }
        main { padding: 0 !important; }
      `}</style>

      {/* Full-viewport fixed layer that sits above everything in the root layout */}
      <div style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        overflow: "hidden",
        background: "transparent",
        pointerEvents: "none",
      }}>
        <div style={{ pointerEvents: "auto", width: "100%", height: "100%" }}>
          {children}
        </div>
      </div>
    </>
  );
}
