import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function getUrlType(url: string): "youtube" | "gdrive" | "direct" {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("drive.google.com"))                          return "gdrive";
  return "direct";
}

function safeFilename(title: string): string {
  return title.replace(/[^a-zA-Z0-9\s\-_]/g, "").trim().replace(/\s+/g, "_") || "video";
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
  const filename = safeFilename(video.title);

  // Stream mode — proxy the file directly (only for direct URLs)
  if (stream) {
    if (urlType !== "direct") {
      return NextResponse.json({ error: "Cannot proxy this URL type" }, { status: 400 });
    }
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

  // Info mode — return metadata
  return NextResponse.json({
    url:     video.url,
    title:   video.title,
    urlType,
    filename,
    canEliteAudio: user.tier === "ELITE" && urlType === "direct",
  });
}
