import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSpotifyToken } from "@/lib/spotify";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ tracks: [] });

  const token = await getSpotifyToken(session.user.id);
  if (!token) return NextResponse.json({ error: "no_spotify" }, { status: 404 });

  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=10&market=from_token`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );

  if (!res.ok) return NextResponse.json({ tracks: [] });

  const data = await res.json() as {
    tracks: {
      items: {
        id: string;
        uri: string;
        name: string;
        duration_ms: number;
        artists: { name: string }[];
        album: { name: string; images: { url: string }[] };
      }[];
    };
  };

  return NextResponse.json({ tracks: data.tracks?.items ?? [] });
}
