import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Upload, Zap } from "lucide-react";
import UploadForm from "@/components/UploadForm";

export default async function UploadPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "2.5rem 1.5rem" }}>

      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Upload size={19} color="var(--accent-orange)" />
          </div>
          <h1 style={{
            fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.625rem",
            letterSpacing: "-0.02em", color: "var(--text-primary)",
          }}>
            Upload Video
          </h1>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", paddingLeft: "3.25rem" }}>
          Share your content with the LightHouse community
        </p>
      </div>

      {/* Card */}
      <div style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 16,
        padding: "2rem",
      }}>
        <UploadForm categories={categories} />
      </div>

      {/* Tips */}
      <div style={{
        marginTop: "1.5rem",
        padding: "1rem 1.25rem",
        borderRadius: 10,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        display: "flex", gap: "0.75rem", alignItems: "flex-start",
      }}>
        <Zap size={15} color="var(--accent-orange)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
            Tips
          </p>
          <ul style={{ color: "var(--text-muted)", fontSize: "0.8125rem", lineHeight: 1.7, paddingLeft: "1rem" }}>
            <li>Paste a direct link to an <code>.mp4</code>, <code>.webm</code>, or any browser-playable format</li>
            <li>Duration is in seconds — 1 hour = 3600</li>
            <li>Premium videos are only visible to active subscribers</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
