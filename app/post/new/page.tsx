import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { FileText, Zap } from "lucide-react";
import PostForm from "@/components/PostForm";

export default async function NewPostPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2.5rem 1.5rem" }}>

      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <FileText size={19} color="var(--accent-orange)" />
          </div>
          <h1 style={{
            fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.625rem",
            letterSpacing: "-0.02em", color: "var(--text-primary)",
          }}>
            Write a Post
          </h1>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", paddingLeft: "3.25rem" }}>
          Share your ideas, guides, or stories with the community
        </p>
      </div>

      {/* Card */}
      <div style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 16,
        padding: "2rem",
      }}>
        <PostForm />
      </div>

      {/* Tip */}
      <div style={{
        marginTop: "1.5rem", padding: "1rem 1.25rem", borderRadius: 10,
        background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
        display: "flex", gap: "0.75rem", alignItems: "flex-start",
      }}>
        <Zap size={15} color="var(--accent-orange)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{
            fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.8125rem",
            color: "var(--text-secondary)", marginBottom: "0.25rem",
          }}>
            Tips
          </p>
          <ul style={{ color: "var(--text-muted)", fontSize: "0.8125rem", lineHeight: 1.7, paddingLeft: "1rem" }}>
            <li>Write clearly — your readers come from all backgrounds</li>
            <li>Premium posts are only visible to active subscribers</li>
            <li>After publishing you will be redirected to your post</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
