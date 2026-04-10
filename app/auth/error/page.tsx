import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default function AuthErrorPage() {
  return (
    <div style={{ minHeight: "calc(100vh - 64px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ width: 56, height: 56, background: "rgba(239,68,68,0.1)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem" }}>
          <AlertCircle size={28} color="#ef4444" />
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.75rem", marginBottom: "0.75rem" }}>
          Authentication Error
        </h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>
          Something went wrong during sign in. Please try again.
        </p>
        <Link href="/auth/signin" className="btn-primary" style={{ textDecoration: "none", display: "inline-block" }}>
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}
