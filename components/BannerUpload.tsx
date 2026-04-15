"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, X, Loader2 } from "lucide-react";
import { updateUserBanner, removeUserBanner } from "@/actions/profile";

export default function BannerUpload({ currentBanner }: { currentBanner: string | null }) {
  const [preview, setPreview] = useState<string | null>(currentBanner);
  const [pending, start]      = useTransition();
  const [error, setError]     = useState<string | null>(null);
  const inputRef              = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) { setError("Please select an image file"); return; }
    if (file.size > 3_000_000) { setError("Image must be under 3MB"); return; }
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      start(async () => {
        const res = await updateUserBanner(dataUrl);
        if ("error" in res) { setError(res.error ?? "Error"); setPreview(currentBanner); }
      });
    };
    reader.readAsDataURL(file);
  }

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    start(async () => {
      await removeUserBanner();
      setPreview(null);
    });
  }

  return (
    /* Banner container — 6:1 aspect ratio */
    <div
      className="relative w-full group cursor-pointer"
      style={{ aspectRatio: "5/1", minHeight: 80 }}
      onClick={() => inputRef.current?.click()}
    >
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Channel banner" className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: "linear-gradient(135deg, #0d0d1a 0%, rgba(249,115,22,0.18) 60%, #14120a 100%)" }}
          />
        )}
      </div>

      {/* Upload overlay on hover */}
      <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/45">
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-9 h-9 rounded-full bg-white/15 border border-white/30 flex items-center justify-center">
            <Camera size={16} color="white" />
          </div>
          <span className="text-white text-[0.72rem] font-display font-bold tracking-wide">
            {preview ? "Change Banner" : "Add Banner"}
          </span>
        </div>
      </div>

      {/* Loading overlay */}
      {pending && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <Loader2 size={22} className="text-white animate-spin" />
        </div>
      )}

      {/* Remove button (only when banner exists) */}
      {preview && !pending && (
        <button
          onClick={handleRemove}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-black/80"
          title="Remove banner"
        >
          <X size={13} />
        </button>
      )}

      {/* Error toast */}
      {error && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-red-500/90 backdrop-blur-sm text-white text-[0.72rem] font-display px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
          {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
    </div>
  );
}
