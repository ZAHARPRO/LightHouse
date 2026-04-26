import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSpotifyToken } from "@/lib/spotify";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await getSpotifyToken(session.user.id);
  if (!token) return NextResponse.json({ error: "no_spotify" }, { status: 404 });

  return NextResponse.json({ token });
}
