import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { auth } from "@/auth";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: "LiveKit not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const streamId = body.streamId as string | undefined;
  const roomName = streamId ? `stream-${streamId}` : "admin-stream";

  const isAdmin = session.user.role === "ADMIN";
  const identity = session.user.id;
  const name = (session.user as { name?: string }).name ?? identity;

  const at = new AccessToken(apiKey, apiSecret, { identity, name, ttl: "4h" });
  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: isAdmin,
    canPublishData: isAdmin,
    canSubscribe: true,
  });

  const token = await at.toJwt();
  return NextResponse.json({ token, isAdmin });
}
