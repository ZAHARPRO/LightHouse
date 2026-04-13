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
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;
      await signIn("credentials", { email, password, redirect: false });
      router.refresh();
      router.push("/feed");
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-8">
      <div
        className="animate-in bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-10 w-full max-w-[420px]"
      >
        <div className="text-center mb-8">
          <div className="w-[52px] h-[52px] bg-[var(--accent-orange)] rounded-xl flex items-center justify-center mx-auto mb-4">
            <Zap size={24} color="white" strokeWidth={2.5} />
          </div>
          <h1 className="font-display font-extrabold text-[1.625rem] tracking-tight mb-1.5">
            Create account
          </h1>
          <p className="text-[var(--text-secondary)] text-[0.9rem]">
            Join LightHouse and start your journey
          </p>
        </div>

        {/* OAuth */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => signIn("google", { callbackUrl: "/feed" })}
            className="btn-ghost flex-1 flex items-center justify-center gap-2 text-sm"
          >
            <Chrome size={16} /> Google
          </button>
          <button
            onClick={() => signIn("github", { callbackUrl: "/feed" })}
            className="btn-ghost flex-1 flex items-center justify-center gap-2 text-sm"
          >
            <Github size={16} /> GitHub
          </button>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <hr className="sep flex-1" />
          <span className="text-[var(--text-muted)] text-[0.8125rem]">or</span>
          <hr className="sep flex-1" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block font-medium text-sm mb-1.5 text-[var(--text-secondary)]">
              Full Name
            </label>
            <input name="name" type="text" placeholder="Your name" required className="input-field" />
          </div>
          <div>
            <label className="block font-medium text-sm mb-1.5 text-[var(--text-secondary)]">
              Email
            </label>
            <input name="email" type="email" placeholder="you@example.com" required className="input-field" />
          </div>
          <div>
            <label className="block font-medium text-sm mb-1.5 text-[var(--text-secondary)]">
              Password
            </label>
            <div className="relative">
              <input
                name="password"
                type={showPw ? "text" : "password"}
                placeholder="Min. 8 characters"
                required
                minLength={8}
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
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p className="text-center mt-6 text-[var(--text-secondary)] text-sm">
          Already have an account?{" "}
          <Link href="/auth/signin" className="text-[var(--accent-orange)] font-semibold no-underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}