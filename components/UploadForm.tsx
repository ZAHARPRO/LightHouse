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
        className="hidden"
      />

      <div className="flex flex-col gap-5">

        {/* Error */}
        {error && (
          <div className="flex items-center gap-[0.625rem] px-4 py-[0.875rem] rounded-lg bg-red-500/10 border border-red-500/25 text-red-500 text-sm">
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        {/* Title */}
        <Field label="Title" icon={<FileText size={14} className="text-[var(--accent-orange)]" />} required>
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
        <Field label="Video URL" icon={<Video size={14} className="text-[var(--accent-orange)]" />} required>
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
        <Field label="Description" icon={<FileText size={14} className="text-[var(--accent-orange)]" />}>
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
        <Field label="Thumbnail URL" icon={<Link2 size={14} className="text-[var(--accent-orange)]" />}>
          <input
            name="thumbnail"
            type="url"
            placeholder="https://example.com/thumb.jpg (optional)"
            className="input-field"
          />
        </Field>

        {/* Duration + Category row */}
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Duration (seconds)"
            icon={detecting
              ? <Loader size={14} className="text-[var(--accent-orange)] animate-spin" />
              : <Clock size={14} className="text-[var(--accent-orange)]" />
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
              className="input-field cursor-default opacity-70"
            />
          </Field>

          <Field label="Category" icon={<Tag size={14} className="text-[var(--accent-orange)]" />}>
            <select name="categoryId" className="input-field cursor-pointer">
              <option value="">— None —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        </div>

        {/* Premium toggle */}
        <div
          onClick={() => setIsPremium((v) => !v)}
          className={[
            "flex items-center justify-between px-5 py-4 rounded-[10px] cursor-pointer",
            "transition-[background,border-color] duration-200",
            isPremium
              ? "bg-orange-500/[0.07] border border-orange-500/30"
              : "bg-[var(--bg-elevated)] border border-[var(--border-subtle)]",
          ].join(" ")}
        >
          <div className="flex items-center gap-3">
            <Crown size={17} className={isPremium ? "text-[var(--accent-orange)]" : "text-[var(--text-muted)]"} />
            <div>
              <p className={[
                "font-display font-bold text-[0.9rem]",
                isPremium ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]",
              ].join(" ")}>
                Premium Content
              </p>
              <p className="text-[0.8rem] text-[var(--text-muted)] mt-[0.1rem]">
                Only subscribers can watch this video
              </p>
            </div>
          </div>

          {/* Toggle switch */}
          <div className={[
            "w-11 h-6 rounded-full shrink-0 relative transition-colors duration-200",
            isPremium
              ? "bg-[var(--accent-orange)]"
              : "bg-[var(--bg-card)] border border-[var(--border-default)]",
          ].join(" ")}>
            <div className={[
              "absolute w-[18px] h-[18px] rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.3)] transition-all duration-200",
              isPremium ? "top-[3px] left-[23px]" : "top-[2px] left-[2px]",
            ].join(" ")} />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={pending}
          className={[
            "btn-primary flex items-center justify-center gap-2",
            "py-3 text-[0.9375rem] rounded-[10px]",
            pending ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
          ].join(" ")}
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
      <label className="flex items-center gap-[0.375rem] font-display font-semibold text-[0.8125rem] text-[var(--text-secondary)] mb-2">
        {icon}
        {label}
        {required && <span className="text-[var(--accent-orange)] ml-0.5">*</span>}
        {hint && (
          <span className="ml-auto text-[var(--accent-orange)] font-medium text-xs">{hint}</span>
        )}
      </label>
      {children}
    </div>
  );
}
