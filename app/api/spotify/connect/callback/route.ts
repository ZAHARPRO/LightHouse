import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/auth/signin", req.url));
  }

  const { searchParams, origin } = new URL(req.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/?spotify_error=denied", req.url));
  }

  const jar = await cookies();
  const storedState = jar.get("spotify_oauth_state")?.value;
  jar.delete("spotify_oauth_state");

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(new URL("/?spotify_error=state", req.url));
  }

  // Exchange code for tokens
  const creds = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${creds}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${origin}/api/spotify/connect/callback`,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/?spotify_error=token", req.url));
  }

  const tokens = await tokenRes.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
  };

  // Get Spotify user profile to get providerAccountId
  const profileRes = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!profileRes.ok) {
    return NextResponse.redirect(new URL("/?spotify_error=profile", req.url));
  }

  const profile = await profileRes.json() as { id: string };
  const nowSec = Math.floor(Date.now() / 1000);

  // Upsert the Account record linked to the current user
  await prisma.account.upsert({
    where: { provider_providerAccountId: { provider: "spotify", providerAccountId: profile.id } },
    create: {
      userId:            session.user.id,
      type:              "oauth",
      provider:          "spotify",
      providerAccountId: profile.id,
      access_token:      tokens.access_token,
      refresh_token:     tokens.refresh_token,
      expires_at:        nowSec + tokens.expires_in,
      token_type:        tokens.token_type,
      scope:             tokens.scope,
    },
    update: {
      userId:        session.user.id,
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at:    nowSec + tokens.expires_in,
      scope:         tokens.scope,
    },
  });

  return NextResponse.redirect(new URL("/?spotify_connected=1", req.url));
}
