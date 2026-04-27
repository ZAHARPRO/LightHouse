import { NextResponse } from "next/server";
import { auth } from "@/auth";

function extractPlaylistId(input: string): string | null {
  try {
    const url = new URL(input.trim());
    return url.searchParams.get("list");
  } catch {
    // Maybe it's just the ID
    if (/^[A-Za-z0-9_-]{10,}$/.test(input.trim())) return input.trim();
    return null;
  }
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return NextResponse.json({ error: "No API key" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("url") ?? "";
  const playlistId = extractPlaylistId(raw);
  if (!playlistId) return NextResponse.json({ error: "Invalid playlist URL" }, { status: 400 });

  const tracks: { videoId: string; title: string; channel: string; thumbnail: string }[] = [];
  let pageToken: string | undefined;

  // Fetch up to 200 items (4 pages of 50)
  for (let page = 0; page < 4; page++) {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("key", key);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) break;

    const data = await res.json() as {
      nextPageToken?: string;
      items: {
        snippet: {
          title: string;
          videoOwnerChannelTitle?: string;
          resourceId: { videoId: string };
          thumbnails?: { medium?: { url: string }; default?: { url: string } };
        };
      }[];
    };

    for (const item of data.items ?? []) {
      const videoId = item.snippet.resourceId.videoId;
      if (!videoId || videoId === "deleted") continue;
      tracks.push({
        videoId,
        title: item.snippet.title,
        channel: item.snippet.videoOwnerChannelTitle ?? "",
        thumbnail:
          item.snippet.thumbnails?.medium?.url ??
          item.snippet.thumbnails?.default?.url ??
          `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      });
    }

    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  return NextResponse.json({ tracks, count: tracks.length });
}
