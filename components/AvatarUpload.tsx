"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { updateUserAvatar, removeUserAvatar } from "@/actions/profile";

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const SIZE = 128;
      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d")!;
      // Center-crop to square
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, SIZE, SIZE);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.88));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Load failed")); };
    img.src = url;
  });
}

interface Props {
  currentImage: string | null;
  tierColor: string;
  name: string;
}

export default function AvatarUpload({ currentImage, tierColor, name }: Props) {
  const [image, setImage]     = useState(currentImage);
  const [pending, start]      = useTransition();
  const [showDel, setShowDel] = useState(false);
  const fileRef               = useRef<HTMLInputElement>(null);
  const { update }            = useSession();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    start(async () => {
      try {
        const dataUrl = await compressImage(file);
        setImage(dataUrl);
        const result = await updateUserAvatar(dataUrl);
        if (result.ok) await update(); // refresh session → navbar avatar updates instantly
      } catch { /* ignore */ }
    });
  }

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    setImage(null);
    setShowDel(false);
    start(async () => {
      await removeUserAvatar();
      await update(); // refresh session → navbar clears avatar instantly
    });
  }

  return (
    <div
      className="relative shrink-0"
      style={{ width: 88, height: 88 }}
      onMouseEnter={() => setShowDel(!!image)}
      onMouseLeave={() => setShowDel(false)}
    >
      {/* Avatar circle */}
      <div
        style={{ background: `${tierColor}22`, border: `3px solid ${tierColor}44` }}
        className="w-full h-full rounded-full flex items-center justify-center overflow-hidden"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="avatar" className="w-full h-full object-cover" />
        ) : (
          <span style={{ color: tierColor }} className="font-display font-extrabold text-[2.25rem]">
            {(name || "U")[0].toUpperCase()}
          </span>
        )}
      </div>

      {/* Upload overlay */}
      <button
        onClick={() => fileRef.current?.click()}
        disabled={pending}
        className="absolute inset-0 rounded-full flex items-center justify-center bg-black/0 hover:bg-black/55 transition-[background] cursor-pointer border-none"
        title="Change avatar"
      >
        {pending ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <Camera size={20} color="white" className="opacity-0 hover:opacity-100 transition-opacity" />
        )}
      </button>

      {/* Remove button — top-right corner */}
      {showDel && !pending && (
        <button
          onClick={handleRemove}
          className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center bg-red-500 border-2 border-[var(--bg-card)] cursor-pointer"
          title="Remove avatar"
        >
          <Trash2 size={10} color="white" />
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
