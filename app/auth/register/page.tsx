"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { registerUser } from "@/actions/auth";
import { Zap, Eye, EyeOff, Github, Chrome } from "lucide-react";

export default function RegisterPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const formData = new FormData(e.currentTarget);
    const result = await registerUser(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      // Auto-login after register
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;
      await signIn("credentials", { email, password, redirect: false });
      router.push("/feed");
    }
  }

  return (
    <div
      style={{
        minHeight: "calc(100vh - 64px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
      }}
    >
      <div
        className="animate-in"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 16,
          padding: "2.5rem",
          width: "100%",
          maxWidth: 420,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div
            style={{
              width: 52,
              height: 52,
              background: "var(--accent-orange)",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem",
            }}
          >
            <Zap size={24} color="white" strokeWidth={2.5} />
          </div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "1.625rem",
              letterSpacing: "-0.02em",
              marginBottom: "0.375rem",
            }}
          >
            Create account
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Join LightHouse and start your journey
          </p>
        </div>

        {/* OAuth */}
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <button
            onClick={() => signIn("google", { callbackUrl: "/feed" })}
            className="btn-ghost"
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", fontSize: "0.875rem" }}
          >
            <Chrome size={16} /> Google
          </button>
          <button
            onClick={() => signIn("github", { callbackUrl: "/feed" })}
            className="btn-ghost"
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", fontSize: "0.875rem" }}
          >
            <Github size={16} /> GitHub
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <hr className="sep" style={{ flex: 1 }} />
          <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>or</span>
          <hr className="sep" style={{ flex: 1 }} />
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontWeight: 500, fontSize: "0.875rem", marginBottom: "0.375rem", color: "var(--text-secondary)" }}>
              Full Name
            </label>
            <input name="name" type="text" placeholder="Your name" required className="input-field" />
          </div>
          <div>
            <label style={{ display: "block", fontWeight: 500, fontSize: "0.875rem", marginBottom: "0.375rem", color: "var(--text-secondary)" }}>
              Email
            </label>
            <input name="email" type="email" placeholder="you@example.com" required className="input-field" />
          </div>
          <div>
            <label style={{ display: "block", fontWeight: 500, fontSize: "0.875rem", marginBottom: "0.375rem", color: "var(--text-secondary)" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                name="password"
                type={showPw ? "text" : "password"}
                placeholder="Min. 8 characters"
                required
                minLength={8}
                className="input-field"
                style={{ paddingRight: "3rem" }}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                style={{ position: "absolute", right: "0.875rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p style={{ color: "#ef4444", fontSize: "0.875rem", padding: "0.5rem 0.75rem", background: "rgba(239,68,68,0.1)", borderRadius: 6 }}>
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: "0.5rem" }}>
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "1.5rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          Already have an account?{" "}
          <Link href="/auth/signin" style={{ color: "var(--accent-orange)", fontWeight: 600, textDecoration: "none" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
