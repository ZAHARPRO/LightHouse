import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSpotifyToken } from "@/lib/spotify";

const BASE = "https://api.spotify.com/v1/me/player";

type Body = {
  action: string;
  positionMs?: number;
  volume?: number;
  uri?: string;
  deviceId?: string;
  play?: boolean;
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await getSpotifyToken(session.user.id);
  if (!token) return NextResponse.json({ error: "no_spotify" }, { status: 404 });

  const res = await fetch(`${BASE}?additional_types=track`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 204) return NextResponse.json(null);
  if (!res.ok) return NextResponse.json({ error: "spotify_error" }, { status: res.status });

  return NextResponse.json(await res.json());
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await getSpotifyToken(session.user.id);
  if (!token) return NextResponse.json({ error: "no_spotify" }, { status: 404 });

  const body = await req.json() as Body;
  const { action } = body;

  if (action === "transfer") {
    const res = await fetch(BASE, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ device_ids: [body.deviceId], play: body.play ?? false }),
    });
    return NextResponse.json({ ok: res.ok });
  }

  type Endpoint = { url: string; method: string };
  const endpoints: Record<string, Endpoint> = {
    play:   { url: `${BASE}/play`,     method: "PUT" },
    pause:  { url: `${BASE}/pause`,    method: "PUT" },
    next:   { url: `${BASE}/next`,     method: "POST" },
    prev:   { url: `${BASE}/previous`, method: "POST" },
    seek:   { url: `${BASE}/seek?position_ms=${body.positionMs ?? 0}`, method: "PUT" },
    volume: { url: `${BASE}/volume?volume_percent=${body.volume ?? 50}`, method: "PUT" },
  };

  const ep = endpoints[action];
  if (!ep) return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  const fetchOpts: RequestInit = {
    method: ep.method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  };

  if (action === "play") {
    if (body.uri) {
      fetchOpts.body = JSON.stringify({ uris: [body.uri], position_ms: body.positionMs ?? 0 });
    } else if (body.positionMs !== undefined) {
      fetchOpts.body = JSON.stringify({ position_ms: body.positionMs });
    }
  }

  const res = await fetch(ep.url, fetchOpts);
  return NextResponse.json({ ok: res.ok });
}
