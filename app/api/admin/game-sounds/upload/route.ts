import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createClient } from "@supabase/supabase-js";

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB for direct uploads
const MAX_YT_BYTES   = 5 * 1024 * 1024; // 5 MB for YouTube downloads
const BUCKET = "game-sounds";

const ALLOWED_AUDIO = new Set([
  "audio/mpeg", "audio/mp3", "audio/ogg", "audio/wav",
  "audio/webm", "audio/aac", "audio/flac", "audio/x-wav",
]);
const AUDIO_EXT_RE = /\.(mp3|ogg|wav|webm|aac|flac|m4a)$/i;

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

function sbClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function ensureBucket() {
  const sb = sbClient();
  // createBucket is idempotent — ignore "already exists" errors
  await sb.storage.createBucket(BUCKET, { public: true }).catch(() => {});
}

async function uploadToStorage(buf: Buffer, name: string, mime: string): Promise<string> {
  await ensureBucket();
  const sb = sbClient();
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(name, buf, { contentType: mime, upsert: true });
  if (error) throw new Error(error.message);
  const { data } = sb.storage.from(BUCKET).getPublicUrl(name);
  return data.publicUrl;
}

// ── POST /api/admin/game-sounds/upload ────────────────────────────────────────
// multipart/form-data  { file: File }              → uploads file to Supabase
// application/json     { url: string }             → downloads YT audio, uploads
export async function POST(req: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ct = req.headers.get("content-type") ?? "";

  // ── File upload ────────────────────────────────────────────────────────────
  if (ct.includes("multipart/form-data")) {
    let form: FormData;
    try { form = await req.formData(); }
    catch { return NextResponse.json({ error: "Invalid form data" }, { status: 400 }); }

    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    if (file.size > MAX_FILE_BYTES)
      return NextResponse.json({ error: "File too large — max 2 MB" }, { status: 400 });

    if (!ALLOWED_AUDIO.has(file.type) && !AUDIO_EXT_RE.test(file.name))
      return NextResponse.json({ error: "Invalid file type. Use mp3, ogg, wav, webm, aac or flac." }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp3";
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());

    try {
      const url = await uploadToStorage(buf, name, file.type || `audio/${ext}`);
      return NextResponse.json({ url });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  // ── YouTube URL ────────────────────────────────────────────────────────────
  if (ct.includes("application/json")) {
    let body: { url?: string };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    if (!body.url?.trim())
      return NextResponse.json({ error: "Missing url" }, { status: 400 });

    try {
      // Dynamic import — ytdl-core is Node-only, keep it out of the module graph at build time
      const ytdl = (await import("@distube/ytdl-core")).default;

      const info = await ytdl.getInfo(body.url.trim());
      const formats = ytdl.filterFormats(info.formats, "audioonly");

      if (!formats.length)
        return NextResponse.json({ error: "No audio-only formats found for this video" }, { status: 400 });

      // Prefer the lowest bitrate to keep file small (game sounds don't need hi-fi)
      const fmt = [...formats].sort((a, b) => (a.audioBitrate ?? 999) - (b.audioBitrate ?? 999))[0];

      // Stream with size cap
      const stream = ytdl.downloadFromInfo(info, { format: fmt });
      const chunks: Buffer[] = [];
      let total = 0;

      await new Promise<void>((resolve, reject) => {
        stream.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > MAX_YT_BYTES) { stream.destroy(); reject(new Error("too_large")); return; }
          chunks.push(chunk);
        });
        stream.on("end", resolve);
        stream.on("error", reject);
      });

      const buf = Buffer.concat(chunks);
      const ext = fmt.container ?? "webm";
      const mime = fmt.mimeType?.split(";")[0] ?? `audio/${ext}`;
      const name = `yt-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const url = await uploadToStorage(buf, name, mime);
      return NextResponse.json({ url, title: info.videoDetails.title });

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "too_large")
        return NextResponse.json({ error: `YouTube audio too large (max ${MAX_YT_BYTES / 1024 / 1024} MB). Use a shorter clip.` }, { status: 400 });
      console.error("[yt-audio]", msg);
      return NextResponse.json({ error: "Failed to extract audio from YouTube. Make sure the video is public." }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unsupported Content-Type" }, { status: 415 });
}
