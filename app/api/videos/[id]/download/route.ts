import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ytdl from "@distube/ytdl-core";

function getUrlType(url: string): "youtube" | "gdrive" | "direct" {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("drive.google.com"))                          return "gdrive";
  return "direct";
}

function safeFilename(title: string): string {
  return title.replace(/[^a-zA-Z0-9\s\-_]/g, "").trim().replace(/\s+/g, "_") || "video";
}

/** Convert a Node.js Readable into a Web API ReadableStream */
function nodeToWebStream(nodeStream: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data",  (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      nodeStream.on("end",   ()              => controller.close());
      nodeStream.on("error", (err: Error)    => controller.error(err));
    },
    cancel() {
      (nodeStream as NodeJS.ReadableStream & { destroy?(): void }).destroy?.();
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { tier: true },
  });

  if (!user || (user.tier !== "PRO" && user.tier !== "ELITE")) {
    return NextResponse.json({ error: "Pro or Elite plan required" }, { status: 403 });
  }

  const { id } = await params;
  const video = await prisma.video.findUnique({
    where: { id },
    select: { url: true, title: true },
  });

  if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });

  const urlType  = getUrlType(video.url);
  const stream   = req.nextUrl.searchParams.get("stream") === "true";
  const audioOnly = req.nextUrl.searchParams.get("audio") === "true";
  const filename = safeFilename(video.title);

  // ── Stream / download ────────────────────────────────────────────────────────
  if (stream) {

    // YouTube — stream via ytdl-core
    if (urlType === "youtube") {
      try {
        const info = await ytdl.getInfo(video.url);

        if (audioOnly) {
          // Elite audio: best quality audio-only stream
          const format = ytdl.chooseFormat(info.formats, {
            quality: "highestaudio",
            filter:  "audioonly",
          });
          const ext  = format.container ?? "webm";
          const mime = format.mimeType?.split(";")[0] ?? "audio/webm";
          const nodeStream = ytdl.downloadFromInfo(info, { format });
          const headers: Record<string, string> = {
            "Content-Type":        mime,
            "Content-Disposition": `attachment; filename="${filename}.${ext}"`,
            "Cache-Control":       "no-store",
          };
          if (format.contentLength) headers["Content-Length"] = format.contentLength;
          return new Response(nodeToWebStream(nodeStream), { headers });
        }

        // Video: prefer combined (video+audio) up to highest available
        let format = ytdl.chooseFormat(info.formats, {
          quality: "highestvideo",
          filter:  "videoandaudio",
        });
        // If no combined format exists (4K+), fall back to best combined at lower quality
        if (!format) {
          format = ytdl.chooseFormat(info.formats, { filter: "videoandaudio" });
        }

        const ext  = format.container ?? "mp4";
        const mime = format.mimeType?.split(";")[0] ?? "video/mp4";
        const nodeStream = ytdl.downloadFromInfo(info, { format });
        const headers: Record<string, string> = {
          "Content-Type":        mime,
          "Content-Disposition": `attachment; filename="${filename}.${ext}"`,
          "Cache-Control":       "no-store",
        };
        if (format.contentLength) headers["Content-Length"] = format.contentLength;
        return new Response(nodeToWebStream(nodeStream), { headers });

      } catch (err) {
        console.error("[download] ytdl error:", err);
        return NextResponse.json({ error: "Failed to fetch YouTube video" }, { status: 502 });
      }
    }

    // Direct URL — proxy the raw file
    if (urlType === "direct") {
      try {
        const upstream = await fetch(video.url);
        if (!upstream.ok || !upstream.body) {
          return NextResponse.json({ error: "Failed to fetch video" }, { status: 502 });
        }
        const contentType   = upstream.headers.get("content-type") ?? "video/mp4";
        const contentLength = upstream.headers.get("content-length");
        const headers: Record<string, string> = {
          "Content-Type":        contentType,
          "Content-Disposition": `attachment; filename="${filename}.mp4"`,
          "Cache-Control":       "no-store",
        };
        if (contentLength) headers["Content-Length"] = contentLength;
        return new Response(upstream.body, { headers });
      } catch {
        return NextResponse.json({ error: "Proxy error" }, { status: 502 });
      }
    }

    return NextResponse.json({ error: "Cannot proxy this URL type" }, { status: 400 });
  }

  // ── Info mode — metadata only ────────────────────────────────────────────────
  const canEliteAudio = user.tier === "ELITE" && (urlType === "direct" || urlType === "youtube");
  return NextResponse.json({ url: video.url, title: video.title, urlType, filename, canEliteAudio });
}
