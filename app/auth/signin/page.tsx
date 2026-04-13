"use client";

import { signIn, useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Github, Chrome, Zap, Eye, EyeOff } from "lucide-react";

export default function SignInPage() {
  const { status } = useSession();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/feed");
  }, [status, router]);

  if (status === "authenticated") return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Invalid email or password.");
      setLoading(false);
    } else {
      window.location.href = "/feed";
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-8 relative">
      {/* bg glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[radial-gradient(ellipse,rgba(249,115,22,0.06)_0%,transparent_70%)] pointer-events-none" />

      <div className="animate-in bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-10 w-full max-w-[420px]">
        {/* Logo mark */}
        <div className="text-center mb-8">
          <div className="w-[52px] h-[52px] bg-[var(--accent-orange)] rounded-xl flex items-center justify-center mx-auto mb-4">
            <Zap size={24} color="white" strokeWidth={2.5} />
          </div>
          <h1 className="font-display font-extrabold text-[1.625rem] tracking-tight mb-1.5">
            Welcome back
          </h1>
          <p className="text-[var(--text-secondary)] text-[0.9rem]">
            Sign in to your LightHouse account
          </p>
        </div>

        {/* OAuth buttons */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => signIn("google", { callbackUrl: "/feed" })}
            className="btn-ghost flex-1 flex items-center justify-center gap-2 text-sm"
          >
            <Chrome size={16} />
            Google
          </button>
          <button
            onClick={() => signIn("github", { callbackUrl: "/feed" })}
            className="btn-ghost flex-1 flex items-center justify-center gap-2 text-sm"
          >
            <Github size={16} />
            GitHub
          </button>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <hr className="sep flex-1" />
          <span className="text-[var(--text-muted)] text-[0.8125rem]">or</span>
          <hr className="sep flex-1" />
        </div>

        {/* Credentials form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block font-medium text-sm mb-1.5 text-[var(--text-secondary)]">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="input-field"
            />
          </div>

          <div>
            <label className="block font-medium text-sm mb-1.5 text-[var(--text-secondary)]">
              Password
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="input-field pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-[var(--text-muted)]"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm px-3 py-2 bg-red-500/10 rounded-md">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary mt-2" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="text-center mt-6 text-[var(--text-secondary)] text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" className="text-[var(--accent-orange)] font-semibold no-underline">
            Create one free
          </Link>
        </p>
      </div>
    </div>
  );
}