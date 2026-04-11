"use client";

import { useRef, useState, useTransition } from "react";
import { createVideo } from "@/actions/videos";
import { Upload, Video, FileText, Link2, Clock, Crown, Tag, AlertCircle, Loader } from "lucide-react";

type Category = { id: string; name: string };

export default function UploadForm({ categories }: { categories: Category[] }) {
  const [isPremium, setIsPremium]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [pending, startTransition]  = useTransition();
  const [duration, setDuration]     = useState<number | "">("");
  const [detecting, setDetecting]   = useState(false);
  const formRef    = useRef<HTMLFormElement>(null);
  const videoRef   = useRef<HTMLVideoElement>(null);
  const urlTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    const url = e.target.value.trim();
    if (urlTimeout.current) clearTimeout(urlTimeout.current);
    if (!url) return;
    // Google Drive can't expose metadata via <video> — skip detection
    if (url.includes("drive.google.com")) return;

    urlTimeout.current = setTimeout(() => {
      setDetecting(true);
      const vid = videoRef.current!;
      vid.src = url;
      vid.load();
    }, 600);
  }

  function handleMetadata() {
    const vid = videoRef.current!;
    const secs = Math.round(vid.duration);
    if (isFinite(secs) && secs > 0) setDuration(secs);
    setDetecting(false);
    vid.src = "";
  }

  function handleVideoError() {
    setDetecting(false);
    videoRef.current!.src = "";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(formRef.current!);
    if (isPremium) fd.set("isPremium", "on");
    startTransition(async () => {
      const res = await createVideo(fd);
      if (res && "error" in res) setError(res.error);
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      {/* Hidden video for duration detection */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        preload="metadata"
        onLoadedMetadata={handleMetadata}
        onError={handleVideoError}
        style={{ display: "none" }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

        {/* Error */}
        {error && (
          <div style={{
            display: "flex", alignItems: "center", gap: "0.625rem",
            padding: "0.875rem 1rem", borderRadius: 8,
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
            color: "#ef4444", fontSize: "0.875rem",
          }}>
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        {/* Title */}
        <Field label="Title" icon={<FileText size={14} color="var(--accent-orange)" />} required>
          <input
            name="title"
            type="text"
            placeholder="Enter video title"
            required
            maxLength={200}
            className="input-field"
          />
        </Field>

        {/* Video URL */}
        <Field label="Video URL" icon={<Video size={14} color="var(--accent-orange)" />} required>
          <input
            name="url"
            type="url"
            placeholder="https://example.com/video.mp4"
            required
            onChange={handleUrlChange}
            className="input-field"
          />
        </Field>

        {/* Description */}
        <Field label="Description" icon={<FileText size={14} color="var(--accent-orange)" />}>
          <textarea
            name="description"
            placeholder="Tell viewers what this video is about…"
            rows={4}
            maxLength={2000}
            className="input-field"
            style={{ resize: "vertical", minHeight: 100 }}
          />
        </Field>

        {/* Thumbnail URL */}
        <Field label="Thumbnail URL" icon={<Link2 size={14} color="var(--accent-orange)" />}>
          <input
            name="thumbnail"
            type="url"
            placeholder="https://example.com/thumb.jpg (optional)"
            className="input-field"
          />
        </Field>

        {/* Duration + Category row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <Field
            label="Duration (seconds)"
            icon={detecting
              ? <Loader size={14} color="var(--accent-orange)" style={{ animation: "spin 1s linear infinite" }} />
              : <Clock size={14} color="var(--accent-orange)" />
            }
            hint={detecting ? "Detecting…" : duration ? "Auto-detected" : undefined}
          >
            <input
              name="duration"
              type="number"
              min={1}
              max={86400}
              placeholder={detecting ? "Detecting…" : "Will be detected from URL"}
              value={duration}
              readOnly
              className="input-field"
              style={{ cursor: "default", opacity: 0.7 }}
            />
          </Field>

          <Field label="Category" icon={<Tag size={14} color="var(--accent-orange)" />}>
            <select name="categoryId" className="input-field" style={{ cursor: "pointer" }}>
              <option value="">— None —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        </div>

        {/* Premium toggle */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "1rem 1.25rem", borderRadius: 10,
          background: isPremium ? "rgba(249,115,22,0.07)" : "var(--bg-elevated)",
          border: isPremium ? "1px solid rgba(249,115,22,0.3)" : "1px solid var(--border-subtle)",
          transition: "background 0.2s, border-color 0.2s",
          cursor: "pointer",
        }}
          onClick={() => setIsPremium((v) => !v)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Crown size={17} color={isPremium ? "var(--accent-orange)" : "var(--text-muted)"} />
            <div>
              <p style={{
                fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.9rem",
                color: isPremium ? "var(--text-primary)" : "var(--text-secondary)",
              }}>
                Premium Content
              </p>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>
                Only subscribers can watch this video
              </p>
            </div>
          </div>

          {/* Toggle switch */}
          <div style={{
            width: 44, height: 24, borderRadius: 12, flexShrink: 0,
            background: isPremium ? "var(--accent-orange)" : "var(--bg-card)",
            border: isPremium ? "none" : "1px solid var(--border-default)",
            position: "relative", transition: "background 0.2s",
          }}>
            <div style={{
              position: "absolute", top: isPremium ? 3 : 2, left: isPremium ? 23 : 2,
              width: 18, height: 18, borderRadius: "50%",
              background: "white",
              boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
              transition: "left 0.2s, top 0.2s",
            }} />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={pending}
          className="btn-primary"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
            padding: "0.75rem", fontSize: "0.9375rem", borderRadius: 10,
            opacity: pending ? 0.6 : 1, cursor: pending ? "not-allowed" : "pointer",
          }}
        >
          <Upload size={17} />
          {pending ? "Uploading…" : "Publish Video"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label, icon, required, hint, children,
}: {
  label: string;
  icon: React.ReactNode;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={{
        display: "flex", alignItems: "center", gap: "0.375rem",
        fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.8125rem",
        color: "var(--text-secondary)", marginBottom: "0.5rem",
      }}>
        {icon}
        {label}
        {required && <span style={{ color: "var(--accent-orange)", marginLeft: 2 }}>*</span>}
        {hint && (
          <span style={{ marginLeft: "auto", color: "var(--accent-orange)", fontWeight: 500, fontSize: "0.75rem" }}>
            {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
